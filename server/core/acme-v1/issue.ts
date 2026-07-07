import { Client as AcmeClient, crypto } from "@geektr/acme-dns01";
import { HttpErr } from "@acrux/server";
import { makeProvider } from "./dns";
import type { DnsCredential } from "@server/db/schema";

const decode = (u: Uint8Array) => new TextDecoder().decode(u);

export interface RunAcmeResult {
  key: string;
  cer: string;
  ca: string;
  csr: string;
}

export async function runAcme(
  acmeUrl: string,
  creds: {
    privateKey: string;
    accountUrl: string;
    eab?: { kid: string; hmacKey: string } | null;
  },
  domain: string,
  zoneName: string,
  cred: DnsCredential,
  existing: { key: string; csr: string } | null,
): Promise<RunAcmeResult> {
  const provider = makeProvider(cred);

  let keyStr: string;
  let csrStr: string;
  if (existing?.key && existing?.csr) {
    keyStr = existing.key;
    csrStr = existing.csr;
  } else {
    const keyPem = await crypto.createPrivateEcdsaKey("P-256");
    const [, csrPem] = await crypto.createCsr(
      { commonName: domain, altNames: [domain] },
      keyPem,
    );
    keyStr = decode(keyPem);
    csrStr = decode(csrPem);
  }

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
  });

  const fullChain = await client.auto({
    csr: csrStr,
    termsOfServiceAgreed: true,
    challengeCreateFn: async (_authz, challenge, keyAuth) => {
      if (challenge.type !== "dns-01") throw HttpErr(500, "仅支持 dns-01");
      await provider.add(
        zoneName,
        `_acme-challenge.${_authz.identifier.value}`,
        keyAuth,
      );
    },
    challengeRemoveFn: async (_authz, _challenge, keyAuth) => {
      await provider.remove(
        zoneName,
        `_acme-challenge.${_authz.identifier.value}`,
        keyAuth,
      );
    },
  });

  const [leaf, ...rest] = crypto.splitPemChain(fullChain);
  return {
    key: keyStr,
    csr: csrStr,
    cer: leaf!,
    ca: rest.join("\n"),
  };
}
