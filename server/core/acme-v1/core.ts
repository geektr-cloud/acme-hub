import { desc, eq, and } from "drizzle-orm";
import { HttpErr } from "@acrux/server";
import { crypto } from "@geektr/acme-dns01";
import { db, schema } from "@server/db";
import type { Client } from "@server/db/schema";
import { allowMatch, findAllowMatch } from "./match";
import { decide } from "./decide";
import { needNewKeypair } from "./san";
import { resolveDnsZone } from "./resolve";
import { runAcme } from "./issue";
import type { DomainZone } from "./issue";
import type { CertEmit, CertResult } from "./schema";

export async function requestCert(
  client: Client,
  domains: string[],
  emit?: CertEmit,
): Promise<CertResult> {
  const send = async (e: Parameters<CertEmit>[0]) => {
    await emit?.(e);
  };

  await send({ type: "start", domains, client: client.name });

  for (const d of domains) {
    if (!allowMatch(d, client.allow)) {
      throw HttpErr(403, `域名 ${d} 未通过 allow 校验`);
    }
    const matchedRule = findAllowMatch(d, client.allow);
    if (matchedRule) {
      await send({
        type: "allow-matched",
        domain: d,
        rule: { type: matchedRule.type, pattern: matchedRule.pattern },
      });
    }
  }

  if (!client.acmeAccountId) throw HttpErr(412, "客户端未绑定 ACME 账户");
  const [account] = await db
    .select()
    .from(schema.acmeAccounts)
    .where(eq(schema.acmeAccounts.id, client.acmeAccountId))
    .limit(1);
  if (!account) throw HttpErr(412, "ACME 账户不存在");
  if (!account.creds?.privateKey || !account.creds?.accountUrl)
    throw HttpErr(412, "ACME 账户未注册");

  await send({
    type: "account",
    id: account.id,
    name: account.name,
    acmeUrl: account.acmeUrl,
  });

  const primaryDomain = domains[0]!;
  const [existing] = await db
    .select()
    .from(schema.certificates)
    .where(
      and(
        eq(schema.certificates.acmeAccountId, client.acmeAccountId),
        eq(schema.certificates.domain, primaryDomain),
      ),
    )
    .orderBy(desc(schema.certificates.createdAt))
    .limit(1);

  const decision = decide(existing?.cer);
  let finalMode = decision.mode;
  let reason = decision.mode === "cache" ? "证书有效期未过半" : decision.reason;

  if ((finalMode === "cache" || finalMode === "renew") && existing) {
    if (needNewKeypair(domains, existing.alt as string[])) {
      finalMode = "issue";
      reason = "SAN 域名集变更，需签发新证书";
    }
  }

  await send({ type: "decision", mode: finalMode, reason });

  if (finalMode === "cache" && existing) {
    const info = crypto.readCertificateInfo(existing.cer!);
    await send({ type: "cache-hit", notAfter: info.notAfter.toISOString() });
    const result: CertResult = {
      domain: primaryDomain,
      key: existing.key,
      cer: existing.cer!,
      ca: existing.ca!,
      notAfter: info.notAfter.toISOString(),
    };
    await send({ type: "done", result });
    return result;
  }

  const domainZones: DomainZone[] = [];
  for (const d of domains) {
    const { zone, cred } = await resolveDnsZone(d);
    domainZones.push({ domain: d, zoneName: zone.name, cred });
    await send({
      type: "zone",
      domain: d,
      zone: zone.name,
      credential: cred.name,
      provider: cred.provider,
    });
  }

  const existingKeys =
    finalMode === "renew" && existing?.key && existing?.csr
      ? { key: existing.key, csr: existing.csr }
      : null;

  const acmeResult = await runAcme(
    account.acmeUrl,
    {
      privateKey: account.creds.privateKey,
      accountUrl: account.creds.accountUrl,
      eab: account.creds.eab ?? null,
    },
    domains,
    domainZones,
    existingKeys,
    emit,
  );

  const issuedInfo = crypto.readCertificateInfo(acmeResult.cer);
  await send({ type: "issued", notAfter: issuedInfo.notAfter.toISOString() });

  let certificateId: string;
  if (finalMode === "renew" && existing) {
    await db
      .update(schema.certificates)
      .set({
        key: acmeResult.key,
        csr: acmeResult.csr,
        cer: acmeResult.cer,
        ca: acmeResult.ca,
      })
      .where(eq(schema.certificates.id, existing.id));
    certificateId = existing.id;
  } else {
    const [inserted] = await db
      .insert(schema.certificates)
      .values({
        domain: primaryDomain,
        key: acmeResult.key,
        csr: acmeResult.csr,
        cer: acmeResult.cer,
        ca: acmeResult.ca,
        alt: domains,
        acmeAccountId: client.acmeAccountId,
      })
      .returning({ id: schema.certificates.id });
    certificateId = inserted!.id;
  }

  await send({
    type: "saved",
    certificateId,
    mode: finalMode === "cache" ? "issue" : finalMode,
  });

  const result: CertResult = {
    domain: primaryDomain,
    key: acmeResult.key,
    cer: acmeResult.cer,
    ca: acmeResult.ca,
    notAfter: issuedInfo.notAfter.toISOString(),
  };
  await send({ type: "done", result });
  return result;
}
