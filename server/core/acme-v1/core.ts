import { desc, eq, inArray } from "drizzle-orm";
import { HttpErr } from "@acrux/server";
import { crypto } from "@geektr/acme-dns01";
import { db, schema } from "@server/db";
import type { Client } from "@server/db/schema";
import { allowMatch, findAllowMatch, certAllowed } from "./match";
import { decide, renewAt, cacheControl } from "./decide";
import { assertValidDomainName, pickBestCert } from "./coverage";
import { resolveDnsZone } from "./resolve";
import { runAcme } from "./issue";
import type { DomainZone } from "./issue";
import { certHashOf, lockIdOf } from "./hash";
import { pickPrimaryDomain } from "@server/utils/domain";
import { appendEvent, tailEvents } from "./events";
import { acquire, release } from "../resource-locks/service";
import { v7 as uuidv7 } from "uuid";
import type { CertEmit, CertResult, CertListItem } from "./schema";

const ISSUE_TTL_MS = 120_000;

export async function listCerts(client: Client): Promise<CertListItem[]> {
  if (!client.acmeAccountId) return [];
  const rows = await db
    .select({
      id: schema.certificates.id,
      domain: schema.certificates.domain,
      alt: schema.certificates.alt,
      cer: schema.certificates.cer,
      createdAt: schema.certificates.createdAt,
      updatedAt: schema.certificates.updatedAt,
    })
    .from(schema.certificates)
    .where(eq(schema.certificates.acmeAccountId, client.acmeAccountId))
    .orderBy(desc(schema.certificates.createdAt));

  return rows
    .filter((r) =>
      certAllowed(r.domain, (r.alt as string[]) ?? [], client.allow),
    )
    .map((r) => {
      let notAfter: string | null = null;
      if (r.cer) {
        try {
          notAfter = crypto.readCertificateInfo(r.cer).notAfter.toISOString();
        } catch {
          notAfter = null;
        }
      }
      return {
        id: r.id,
        domain: r.domain,
        alt: (r.alt as string[]) ?? [],
        notAfter,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
}

export async function matchCert(
  client: Client,
  requestedDomains: string[],
): Promise<{
  cert: typeof schema.certificates.$inferSelect;
  decision: ReturnType<typeof decide>;
} | null> {
  for (const d of requestedDomains) {
    assertValidDomainName(d);
    if (!allowMatch(d, client.allow)) {
      throw HttpErr(403, `域名 ${d} 未通过 allow 校验`);
    }
  }

  if (!client.acmeAccountId) return null;

  const certs = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.acmeAccountId, client.acmeAccountId))
    .orderBy(desc(schema.certificates.createdAt));

  const eligible = certs.filter((c) =>
    certAllowed(c.domain, (c.alt as string[]) ?? [], client.allow),
  );

  const best = pickBestCert(
    eligible.map((c) => ({
      ...c,
      alt: (c.alt as string[]) ?? [],
      createdAt: c.createdAt,
    })),
    requestedDomains,
  );

  if (!best) return null;

  const decision = decide(best.cer);
  return { cert: best, decision };
}

async function runIssue(
  runId: string,
  certificateId: string,
  certHash: string,
  account: typeof schema.acmeAccounts.$inferSelect,
  domains: string[],
  existing: { key: string; csr: string } | null,
  emit?: CertEmit,
): Promise<void> {
  const send = async (e: Parameters<CertEmit>[0]) => {
    await appendEvent(runId, certHash, e);
    await emit?.(e);
  };

  try {
    const domainZones: DomainZone[] = [];
    for (const d of domains) {
      const { zone, cred } = await resolveDnsZone(d);
      domainZones.push({ domain: d, zoneName: zone.name, cred });
    }

    const result = await runAcme(
      account.acmeUrl,
      {
        privateKey: account.creds!.privateKey!,
        accountUrl: account.creds!.accountUrl!,
        eab: account.creds!.eab ?? null,
      },
      domains,
      domainZones,
      existing,
      (e) => send(e),
    );

    await db
      .update(schema.certificates)
      .set({
        key: result.key,
        csr: result.csr,
        cer: result.cer,
        ca: result.ca,
        domain: pickPrimaryDomain(domains),
        alt: domains,
        certHash,
      })
      .where(eq(schema.certificates.id, certificateId));

    const issuedInfo = crypto.readCertificateInfo(result.cer);
    await send({
      type: "done",
      result: {
        domain: domains[0]!,
        key: result.key,
        cer: result.cer,
        ca: result.ca,
        notAfter: issuedInfo.notAfter.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendEvent(runId, certHash, { type: "error", message });
    throw err;
  } finally {
    await release(runId);
  }
}

export async function requestCert(
  client: Client,
  domains: string[],
  ctx: { waitUntil(p: Promise<unknown>): void },
  emit?: CertEmit,
): Promise<{ result: CertResult; cacheControl: string }> {
  const send = async (e: Parameters<CertEmit>[0]) => {
    await emit?.(e);
  };

  await send({ type: "start", domains, client: client.name });

  for (const d of domains) {
    assertValidDomainName(d);
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

  const match = await matchCert(client, domains);

  if (match && match.decision.mode === "cache") {
    const info = crypto.readCertificateInfo(match.cert.cer!);
    const ra = renewAt(info);
    await send({ type: "cache-hit", notAfter: info.notAfter.toISOString() });
    const result: CertResult = {
      domain: match.cert.domain,
      key: match.cert.key,
      cer: match.cert.cer!,
      ca: match.cert.ca!,
      notAfter: info.notAfter.toISOString(),
    };
    await send({ type: "done", result });
    return { result, cacheControl: cacheControl(ra) };
  }

  if (match && match.decision.mode === "renew" && match.cert.cer) {
    const info = crypto.readCertificateInfo(match.cert.cer);
    if (info.notAfter.getTime() > Date.now()) {
      await send({ type: "decision", mode: "renew", reason: "证书需续签" });
      const result: CertResult = {
        domain: match.cert.domain,
        key: match.cert.key,
        cer: match.cert.cer,
        ca: match.cert.ca,
        notAfter: info.notAfter.toISOString(),
      };

      const renewRunId = uuidv7();
      const renewCertHash = await certHashOf(client.acmeAccountId!, domains);
      const renewLockIds = await Promise.all(domains.map((d) => lockIdOf(d)));
      const locked = await acquire(
        renewLockIds,
        renewRunId,
        `renew:${renewCertHash}`,
        ISSUE_TTL_MS,
      );
      if (locked) {
        ctx.waitUntil(
          runIssue(renewRunId, match.cert.id, renewCertHash, account, domains, {
            key: match.cert.key,
            csr: match.cert.csr,
          }).catch(() => {}),
        );
      }

      await send({ type: "done", result });
      const ra = renewAt(info);
      return { result, cacheControl: cacheControl(ra) };
    }
  }

  await send({
    type: "decision",
    mode: match ? match.decision.mode : "issue",
    reason: match
      ? match.decision.mode === "renew"
        ? match.decision.reason
        : "证书需续签"
      : "无匹配证书",
  });

  const certHash = await certHashOf(client.acmeAccountId, domains);
  const runId = uuidv7();
  const lockIds = await Promise.all(domains.map((d) => lockIdOf(d)));
  const locked = await acquire(
    lockIds,
    runId,
    `cert:${certHash}`,
    ISSUE_TTL_MS,
  );

  let checkRunId = runId;

  if (locked) {
    let certificateId: string;
    const [existingByHash] = await db
      .select({ id: schema.certificates.id })
      .from(schema.certificates)
      .where(eq(schema.certificates.certHash, certHash))
      .limit(1);

    if (existingByHash) {
      certificateId = existingByHash.id;
    } else {
      const [inserted] = await db
        .insert(schema.certificates)
        .values({
          certHash,
          domain: pickPrimaryDomain(domains),
          alt: domains,
          acmeAccountId: client.acmeAccountId,
        })
        .onConflictDoNothing()
        .returning({ id: schema.certificates.id });
      if (inserted) {
        certificateId = inserted.id;
      } else {
        const [row] = await db
          .select({ id: schema.certificates.id })
          .from(schema.certificates)
          .where(eq(schema.certificates.certHash, certHash))
          .limit(1);
        certificateId = row!.id;
      }
    }

    const existing =
      match?.cert?.key && match?.cert?.csr
        ? { key: match.cert.key, csr: match.cert.csr }
        : null;

    const issuePromise = runIssue(
      runId,
      certificateId,
      certHash,
      account,
      domains,
      existing,
      emit,
    );
    ctx.waitUntil(issuePromise);

    if (emit) {
      let cursor: string | null = null;
      const deadline = Date.now() + ISSUE_TTL_MS;
      let timedOut = true;

      for (;;) {
        const rows = await tailEvents(runId, cursor);
        let terminal = false;
        for (const row of rows) {
          await send(row.event as Parameters<CertEmit>[0]);
          cursor = row.id;
          if (row.event.type === "done" || row.event.type === "error") {
            terminal = true;
            timedOut = false;
          }
        }
        if (terminal) break;
        if (Date.now() > deadline) break;
        await new Promise((r) => setTimeout(r, 750));
      }

      if (timedOut) {
        await send({
          type: "error",
          status: 503,
          message: "签发超时，请重试",
        });
      }
    } else {
      await issuePromise;
    }
  } else {
    const [lockRow] = await db
      .select({ owner: schema.resourceLocks.owner })
      .from(schema.resourceLocks)
      .where(inArray(schema.resourceLocks.id, lockIds))
      .limit(1);
    const ownerRunId = lockRow?.owner;
    if (ownerRunId) checkRunId = ownerRunId;

    if (ownerRunId) {
      const deadline = Date.now() + ISSUE_TTL_MS;

      if (emit) {
        let cursor: string | null = null;
        for (;;) {
          const rows = await tailEvents(ownerRunId, cursor);
          let terminal = false;
          for (const row of rows) {
            await send(row.event as Parameters<CertEmit>[0]);
            cursor = row.id;
            if (row.event.type === "done" || row.event.type === "error") {
              terminal = true;
            }
          }
          if (terminal) break;
          if (Date.now() > deadline) break;
          await new Promise((r) => setTimeout(r, 750));
        }
      } else {
        while (Date.now() < deadline) {
          const [cert] = await db
            .select({ cer: schema.certificates.cer })
            .from(schema.certificates)
            .where(eq(schema.certificates.certHash, certHash))
            .limit(1);
          if (cert?.cer) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } else {
      const deadline = Date.now() + ISSUE_TTL_MS;
      while (Date.now() < deadline) {
        const [cert] = await db
          .select({ cer: schema.certificates.cer })
          .from(schema.certificates)
          .where(eq(schema.certificates.certHash, certHash))
          .limit(1);
        if (cert?.cer) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const [cert] = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.certHash, certHash))
    .limit(1);

  if (cert?.cer) {
    const info = crypto.readCertificateInfo(cert.cer);
    const result: CertResult = {
      domain: cert.domain,
      key: cert.key,
      cer: cert.cer,
      ca: cert.ca,
      notAfter: info.notAfter.toISOString(),
    };
    return { result, cacheControl: "max-age=0, must-revalidate" };
  }

  const allEvents = await tailEvents(checkRunId, null);
  const lastError = [...allEvents]
    .reverse()
    .find((e) => e.event.type === "error");
  if (lastError) {
    const evt = lastError.event as {
      type: "error";
      status?: number;
      message?: string;
    };
    throw HttpErr(502, evt.message ?? "签发失败");
  }

  throw HttpErr(503, "签发进行中，请重试");
}
