import { desc, eq, inArray } from "drizzle-orm";
import { HttpErr } from "@acrux/server";
import { crypto } from "@geektr/acme-dns01";
import { db, schema } from "@server/db";
import type { Consumer } from "@server/db/schema";
import { allowMatch, certAllowed } from "./match";
import { decide, renewAt, cacheControl } from "./decide";
import { assertValidDomainName, pickBestCert } from "./coverage";
import { resolveDnsZone } from "./resolve";
import { runAcme } from "./issue";
import type { DomainZone } from "./issue";
import { certHashOf, lockIdOf } from "./hash";
import { pickPrimaryDomain } from "@server/utils/domain";
import { appendEvent, tailEvents } from "./events";
import { acquire, release } from "../resource-locks/service";
import { getRenewWindowRatio } from "../settings/service";
import { v7 as uuidv7 } from "uuid";
import type { CertEmit, CertResult, CertListItem } from "./schema";

const ISSUE_TTL_MS = 120_000;

function buildCertResult(
  certRow: typeof schema.certificates.$inferSelect,
): CertResult {
  const info = crypto.readCertificateInfo(certRow.certificate);
  return {
    commonName: certRow.commonName,
    sans: (certRow.sans as string[]) ?? [],
    privateKey: certRow.privateKey,
    certificate: certRow.certificate,
    chain: certRow.chain,
    fullchain: certRow.certificate + "\n" + certRow.chain,
    notBefore: info.notBefore.toISOString(),
    notAfter: info.notAfter.toISOString(),
  };
}

export async function listCerts(consumer: Consumer): Promise<CertListItem[]> {
  if (!consumer.acmeAccountId) return [];
  const rows = await db
    .select({
      id: schema.certificates.id,
      commonName: schema.certificates.commonName,
      sans: schema.certificates.sans,
      certificate: schema.certificates.certificate,
      createdAt: schema.certificates.createdAt,
      updatedAt: schema.certificates.updatedAt,
    })
    .from(schema.certificates)
    .where(eq(schema.certificates.acmeAccountId, consumer.acmeAccountId))
    .orderBy(desc(schema.certificates.createdAt));

  return rows
    .filter((r) =>
      certAllowed(r.commonName, (r.sans as string[]) ?? [], consumer.allow),
    )
    .map((r) => {
      let notAfter: string | null = null;
      if (r.certificate) {
        try {
          notAfter = crypto
            .readCertificateInfo(r.certificate)
            .notAfter.toISOString();
        } catch {
          notAfter = null;
        }
      }
      return {
        id: r.id,
        commonName: r.commonName,
        sans: (r.sans as string[]) ?? [],
        notAfter,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
}

export async function matchCert(
  consumer: Consumer,
  requestedDomains: string[],
  ratio: number,
): Promise<{
  cert: typeof schema.certificates.$inferSelect;
  decision: ReturnType<typeof decide>;
} | null> {
  for (const d of requestedDomains) {
    assertValidDomainName(d);
    if (!allowMatch(d, consumer.allow)) {
      throw HttpErr(403, `domain ${d} is not permitted by allow rules`);
    }
  }

  if (!consumer.acmeAccountId) return null;

  const certs = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.acmeAccountId, consumer.acmeAccountId))
    .orderBy(desc(schema.certificates.createdAt));

  const eligible = certs.filter((c) =>
    certAllowed(c.commonName, (c.sans as string[]) ?? [], consumer.allow),
  );

  const best = pickBestCert(
    eligible.map((c) => ({
      ...c,
      domain: c.commonName,
      alt: (c.sans as string[]) ?? [],
      createdAt: c.createdAt,
    })),
    requestedDomains,
  );

  if (!best) return null;

  const decision = decide(best.certificate, Date.now(), ratio);
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
        privateKey: result.key,
        csr: result.csr,
        certificate: result.cer,
        chain: result.ca,
        commonName: pickPrimaryDomain(domains),
        sans: domains,
        certHash,
      })
      .where(eq(schema.certificates.id, certificateId));

    const issuedInfo = crypto.readCertificateInfo(result.cer);
    await send({
      type: "completed",
      result: {
        commonName: domains[0]!,
        sans: domains,
        privateKey: result.key,
        certificate: result.cer,
        chain: result.ca,
        fullchain: result.cer + "\n" + result.ca,
        notBefore: issuedInfo.notBefore.toISOString(),
        notAfter: issuedInfo.notAfter.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendEvent(runId, certHash, { type: "failed", message });
    throw err;
  } finally {
    await release(runId);
  }
}

export async function requestCert(
  consumer: Consumer,
  domains: string[],
  ctx: { waitUntil(p: Promise<unknown>): void },
  emit?: CertEmit,
): Promise<{ result: CertResult; cacheControl: string }> {
  const ratio = await getRenewWindowRatio();

  const send = async (e: Parameters<CertEmit>[0]) => {
    await emit?.(e);
  };

  await send({ type: "started", commonName: domains[0]!, sans: domains });

  for (const d of domains) {
    assertValidDomainName(d);
    if (!allowMatch(d, consumer.allow)) {
      throw HttpErr(403, `domain ${d} is not permitted by allow rules`);
    }
  }

  if (!consumer.acmeAccountId)
    throw HttpErr(412, "consumer is not bound to an ACME account");
  const [account] = await db
    .select()
    .from(schema.acmeAccounts)
    .where(eq(schema.acmeAccounts.id, consumer.acmeAccountId))
    .limit(1);
  if (!account) throw HttpErr(412, "ACME account not found");
  if (!account.creds?.privateKey || !account.creds?.accountUrl)
    throw HttpErr(412, "ACME account not registered");

  const match = await matchCert(consumer, domains, ratio);

  if (match && match.decision.mode === "cache") {
    const info = crypto.readCertificateInfo(match.cert.certificate!);
    const ra = renewAt(info, ratio);
    await send({
      type: "decision",
      mode: "reuse",
      reason: "certificate valid",
    });
    const result = buildCertResult(match.cert);
    await send({ type: "completed", result });
    return { result, cacheControl: cacheControl(ra) };
  }

  if (match && match.decision.mode === "renew" && match.cert.certificate) {
    const info = crypto.readCertificateInfo(match.cert.certificate);
    if (info.notAfter.getTime() > Date.now()) {
      await send({
        type: "decision",
        mode: "renew",
        reason: "certificate needs renewal",
      });
      const result = buildCertResult(match.cert);

      const renewRunId = uuidv7();
      const renewCertHash = await certHashOf(consumer.acmeAccountId!, domains);
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
            key: match.cert.privateKey,
            csr: match.cert.csr,
          }).catch(() => {}),
        );
      }

      await send({ type: "completed", result });
      const ra = renewAt(info, ratio);
      return { result, cacheControl: cacheControl(ra) };
    }
  }

  await send({
    type: "decision",
    mode: match
      ? match.decision.mode === "cache"
        ? "reuse"
        : match.decision.mode
      : "issue",
    reason: match
      ? match.decision.mode === "renew"
        ? match.decision.reason
        : "certificate needs renewal"
      : "no matching certificate",
  });

  const certHash = await certHashOf(consumer.acmeAccountId, domains);
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
          commonName: pickPrimaryDomain(domains),
          sans: domains,
          acmeAccountId: consumer.acmeAccountId,
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
      match?.cert?.privateKey && match?.cert?.csr
        ? { key: match.cert.privateKey, csr: match.cert.csr }
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
          if (row.event.type === "completed" || row.event.type === "failed") {
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
          type: "failed",
          status: 503,
          message: "issuance timed out, please retry",
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
            if (row.event.type === "completed" || row.event.type === "failed") {
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
            .select({ certificate: schema.certificates.certificate })
            .from(schema.certificates)
            .where(eq(schema.certificates.certHash, certHash))
            .limit(1);
          if (cert?.certificate) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } else {
      const deadline = Date.now() + ISSUE_TTL_MS;
      while (Date.now() < deadline) {
        const [cert] = await db
          .select({ certificate: schema.certificates.certificate })
          .from(schema.certificates)
          .where(eq(schema.certificates.certHash, certHash))
          .limit(1);
        if (cert?.certificate) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const [cert] = await db
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.certHash, certHash))
    .limit(1);

  if (cert?.certificate) {
    const result = buildCertResult(cert);
    return { result, cacheControl: "max-age=0, must-revalidate" };
  }

  const allEvents = await tailEvents(checkRunId, null);
  const lastError = [...allEvents]
    .reverse()
    .find((e) => e.event.type === "failed");
  if (lastError) {
    const evt = lastError.event as {
      type: "failed";
      status?: number;
      message?: string;
    };
    throw HttpErr(502, evt.message ?? "issuance failed");
  }

  throw HttpErr(503, "issuance in progress, please retry");
}
