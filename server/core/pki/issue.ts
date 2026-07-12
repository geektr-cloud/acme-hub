import { Client as AcmeClient, crypto as acmeCrypto } from "@geektr/acme-dns01";
import { env } from "cloudflare:workers";
import { HttpErr } from "@acrux/server";
import { createDnsClient } from "@server/utils/dns-clients";
import type { DnsClient } from "@server/utils/dns-clients";
import { DigResolver } from "@server/utils/dig-resolver";
import { acmeProxyFor } from "@server/utils/acme-proxy";
import type { DnsCredential } from "@server/db/schema";
import type { CertEmit } from "./schema";

const decode = (u: Uint8Array) => new TextDecoder().decode(u);

const resolver = new DigResolver({ endpoint: env.CFPAL_ENDPOINT });

async function keyDigest(pem: string): Promise<string> {
  const data = new TextEncoder().encode(pem);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export interface RunAcmeResult {
  key: string;
  cer: string;
  ca: string;
  csr: string;
}

export interface DomainZone {
  domain: string;
  zoneName: string;
  cred: DnsCredential;
}

export async function runAcme(
  acmeUrl: string,
  creds: {
    privateKey: string;
    accountUrl: string;
    eab?: { kid: string; hmacKey: string } | null;
  },
  domains: string[],
  domainZones: DomainZone[],
  existing: { key: string; csr: string } | null,
  emit?: CertEmit,
): Promise<RunAcmeResult> {
  const zoneByDomain = new Map(domainZones.map((dz) => [dz.domain, dz]));
  const dnsByCredId = new Map<string, DnsClient>();

  function getDns(domain: string): { dns: DnsClient; zoneName: string } {
    const bare = domain.replace(/^\*\./, "");
    const dz = zoneByDomain.get(domain) ?? zoneByDomain.get(`*.${bare}`);
    if (!dz)
      throw HttpErr(
        412,
        `domain ${domain} could not be resolved to a DNS zone`,
      );
    if (!dz.cred.creds) throw HttpErr(412, "DNS credential data is empty");
    let dns = dnsByCredId.get(dz.cred.id);
    if (!dns) {
      dns = createDnsClient(dz.cred.provider, dz.cred.creds);
      dnsByCredId.set(dz.cred.id, dns);
    }
    return { dns, zoneName: dz.zoneName };
  }

  const send = async (e: Parameters<CertEmit>[0]) => {
    await emit?.(e);
  };

  let keyStr: string;
  let csrStr: string;
  if (existing?.key && existing?.csr) {
    keyStr = existing.key;
    csrStr = existing.csr;
  } else {
    const keyPem = await acmeCrypto.createPrivateEcdsaKey("P-256");
    const [, csrPem] = await acmeCrypto.createCsr(
      { commonName: domains[0]!, altNames: domains },
      keyPem,
    );
    keyStr = decode(keyPem);
    csrStr = decode(csrPem);
  }

  const remark = `acmehub-${await keyDigest(keyStr)}`;

  const client = new AcmeClient({
    directoryUrl: acmeUrl,
    accountKey: creds.privateKey,
    accountUrl: creds.accountUrl,
    acmeProxy: acmeProxyFor(acmeUrl),
    ...(creds.eab
      ? {
          externalAccountBinding: {
            kid: creds.eab.kid,
            hmacKey: creds.eab.hmacKey,
          },
        }
      : {}),
    backoffAttempts: 8,
    backoffMin: 2000,
    backoffMax: 8000,
    resolver,
  });

  const seenBare = new Set<string>();
  const cleanedBare = new Set<string>();

  const op = client.auto({
    csr: csrStr,
    termsOfServiceAgreed: true,
    challengeCreateFn: async (_authz, challenge, keyAuth) => {
      if (challenge.type !== "dns-01")
        throw HttpErr(500, "only dns-01 is supported");
      const bare = _authz.identifier.value.replace(/^\*\./, "");
      const isNew = !seenBare.has(bare);
      seenBare.add(bare);
      if (isNew)
        await send({ type: "challenge", domain: bare, status: "preparing" });
      const fqdn = `_acme-challenge.${bare}`;
      const { dns, zoneName } = getDns(bare);
      await dns.ensureTxt(zoneName, fqdn, keyAuth, remark);
      if (isNew)
        await send({ type: "challenge", domain: bare, status: "ready" });
    },
    challengeRemoveFn: async (_authz, _challenge, keyAuth) => {
      const bare = _authz.identifier.value.replace(/^\*\./, "");
      if (!cleanedBare.has(bare)) {
        cleanedBare.add(bare);
        await send({ type: "challenge", domain: bare, status: "cleaning" });
      }
      const fqdn = `_acme-challenge.${bare}`;
      try {
        const { dns, zoneName } = getDns(bare);
        await dns.removeTxt(zoneName, fqdn, keyAuth);
      } catch (e) {
        console.warn("DNS challenge cleanup failed:", e);
      }
    },
  });

  const fullChain = await op;

  const [leaf, ...rest] = acmeCrypto.splitPemChain(fullChain);
  return {
    key: keyStr,
    csr: csrStr,
    cer: leaf!,
    ca: rest.join("\n"),
  };
}
