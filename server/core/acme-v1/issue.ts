import {
  Client as AcmeClient,
  crypto as acmeCrypto,
  type AcmeAutoEventMap,
} from "@geektr/acme-dns01";
import { env } from "cloudflare:workers";
import { HttpErr } from "@acrux/server";
import { createDnsClient } from "@server/utils/dns-clients";
import type { DnsClient } from "@server/utils/dns-clients";
import { DigResolver } from "@server/utils/dig-resolver";
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
    if (!dz) throw HttpErr(412, `域名 ${domain} 未解析到 DNS zone`);
    if (!dz.cred.creds) throw HttpErr(412, "DNS 凭据数据为空");
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
    await send({ type: "keygen", reused: true });
  } else {
    const keyPem = await acmeCrypto.createPrivateEcdsaKey("P-256");
    const [, csrPem] = await acmeCrypto.createCsr(
      { commonName: domains[0]!, altNames: domains },
      keyPem,
    );
    keyStr = decode(keyPem);
    csrStr = decode(csrPem);
    await send({ type: "keygen", reused: false });
  }

  const remark = `acmehub-${await keyDigest(keyStr)}`;

  const client = new AcmeClient({
    directoryUrl: acmeUrl,
    accountKey: creds.privateKey,
    accountUrl: creds.accountUrl,
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

  const op = client.auto({
    csr: csrStr,
    termsOfServiceAgreed: true,
    challengeCreateFn: async (_authz, challenge, keyAuth) => {
      if (challenge.type !== "dns-01") throw HttpErr(500, "仅支持 dns-01");
      const bare = _authz.identifier.value.replace(/^\*\./, "");
      const fqdn = `_acme-challenge.${bare}`;
      const { dns, zoneName } = getDns(bare);
      await dns.ensureTxt(zoneName, fqdn, keyAuth, remark);
      await send({ type: "dns-add", fqdn });
    },
    challengeRemoveFn: async (_authz, _challenge, keyAuth) => {
      const bare = _authz.identifier.value.replace(/^\*\./, "");
      const fqdn = `_acme-challenge.${bare}`;
      try {
        const { dns, zoneName } = getDns(bare);
        await dns.removeTxt(zoneName, fqdn, keyAuth);
        await send({ type: "dns-remove", fqdn });
      } catch (e) {
        console.warn("DNS challenge cleanup failed:", e);
      }
    },
  });

  const FORWARDED: (keyof AcmeAutoEventMap)[] = [
    "order:create",
    "order:created",
    "order:finalize",
    "challenge:verify",
    "challenge:complete",
    "challenge:error",
    "dns:txt-check",
    "dns:txt-found",
    "dns:txt-miss",
    "status:poll",
    "status:wait",
  ];
  for (const name of FORWARDED) {
    op.addEventListener(name, (ev) => {
      void send({
        type: "acme-progress",
        event: name,
        detail: ev.detail ?? {},
      });
    });
  }

  const fullChain = await op;

  const [leaf, ...rest] = acmeCrypto.splitPemChain(fullChain);
  return {
    key: keyStr,
    csr: csrStr,
    cer: leaf!,
    ca: rest.join("\n"),
  };
}
