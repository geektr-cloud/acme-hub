import { eq, and, isNotNull, lte, ne } from "drizzle-orm";
import { db, schema } from "@server/db";
import { v7 as uuidv7 } from "uuid";
import { runIssue, ISSUE_TTL_MS } from "./core";
import { lockIdOf } from "./hash";
import { acquire } from "../resource-locks/service";

const MAX_RENEW_PER_RUN = 10;

export async function scanAndRenew(): Promise<void> {
  const now = new Date().toISOString();

  // 查询需要续期的证书
  const certsToRenew = await db
    .select({
      id: schema.certificates.id,
      certHash: schema.certificates.certHash,
      sans: schema.certificates.sans,
      privateKey: schema.certificates.privateKey,
      csr: schema.certificates.csr,
      acmeAccountId: schema.certificates.acmeAccountId,
    })
    .from(schema.certificates)
    .innerJoin(
      schema.acmeAccounts,
      eq(schema.certificates.acmeAccountId, schema.acmeAccounts.id),
    )
    .where(
      and(
        isNotNull(schema.certificates.renewAt),
        lte(schema.certificates.renewAt, now),
        ne(schema.certificates.certificate, ""),
        isNotNull(schema.certificates.acmeAccountId),
      ),
    )
    .orderBy(schema.certificates.renewAt)
    .limit(MAX_RENEW_PER_RUN);

  const totalPending = certsToRenew.length;
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  console.log(
    `[cron] Starting scan: ${totalPending} certificates due for renewal`,
  );

  for (const cert of certsToRenew) {
    try {
      // 获取 ACME 账户信息
      const [account] = await db
        .select()
        .from(schema.acmeAccounts)
        .where(eq(schema.acmeAccounts.id, cert.acmeAccountId!))
        .limit(1);

      if (
        !account ||
        !account.creds?.privateKey ||
        !account.creds?.accountUrl
      ) {
        console.warn(
          `[cron] Skipping certificate ${cert.id}: ACME account not found or not registered`,
        );
        skipCount++;
        continue;
      }

      const domains = cert.sans as string[];
      if (!domains || domains.length === 0) {
        console.warn(
          `[cron] Skipping certificate ${cert.id}: no domains (SANs)`,
        );
        skipCount++;
        continue;
      }

      // 尝试获取锁
      const runId = uuidv7();
      const lockIds = await Promise.all(domains.map((d) => lockIdOf(d)));
      const locked = await acquire(
        lockIds,
        runId,
        `cron:${cert.certHash}`,
        ISSUE_TTL_MS,
      );

      if (!locked) {
        console.log(
          `[cron] Skipping certificate ${cert.id}: domains locked by another process`,
        );
        skipCount++;
        continue;
      }

      // 执行续期
      await runIssue(
        runId,
        cert.id,
        cert.certHash,
        account,
        domains,
        { key: cert.privateKey!, csr: cert.csr! },
        undefined, // 无 emit
      );

      successCount++;
      console.log(`[cron] Successfully renewed certificate ${cert.id}`);
    } catch (err) {
      failCount++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron] Failed to renew certificate ${cert.id}: ${message}`,
      );
    }
  }

  console.log(
    `[cron] Scan complete: ${successCount} renewed, ${skipCount} skipped, ${failCount} failed`,
  );
}
