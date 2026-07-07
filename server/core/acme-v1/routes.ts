import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { HttpErr } from "@acrux/server";
import { db, schema } from "@server/db";
import { crypto } from "@geektr/acme-dns01";
import { RENEW_RATIO } from "./config";
import { allowMatch } from "./match";
import { resolveDnsZone } from "./dns";
import { runAcme } from "./issue";
import { requireClient } from "./middleware";
import type { AcmeV1Env } from "./middleware";
import * as v1Schema from "./schema";

export const acmeV1Routes = new Hono<AcmeV1Env>()
  .use("*", requireClient)
  .post("/cert", zValidator("json", v1Schema.cert.body), async (c) => {
    const client = c.get("client");
    const { domain } = c.req.valid("json");

    if (domain.includes("*")) throw HttpErr(400, "wildcard 域名暂不支持");

    if (!allowMatch(domain, client.allow))
      throw HttpErr(403, "域名未通过 allow 校验");

    if (!client.acmeAccountId) throw HttpErr(412, "客户端未绑定 ACME 账户");
    const [account] = await db
      .select()
      .from(schema.acmeAccounts)
      .where(eq(schema.acmeAccounts.id, client.acmeAccountId))
      .limit(1);
    if (!account) throw HttpErr(412, "ACME 账户不存在");
    if (!account.creds?.privateKey || !account.creds?.accountUrl)
      throw HttpErr(412, "ACME 账户未注册");

    const [existing] = await db
      .select()
      .from(schema.certificates)
      .where(
        and(
          eq(schema.certificates.acmeAccountId, client.acmeAccountId),
          eq(schema.certificates.domain, domain),
        ),
      )
      .orderBy(desc(schema.certificates.createdAt))
      .limit(1);

    let mode: "issue" | "renew" | "cache" = existing ? "renew" : "issue";
    let cacheInfo: { notAfter: Date } | null = null;
    if (existing?.cer) {
      try {
        const info = crypto.readCertificateInfo(existing.cer);
        const now = Date.now();
        const notAfter = info.notAfter.getTime();
        const notBefore = info.notBefore.getTime();

        if (notAfter <= now) {
          mode = "renew";
        } else {
          const lifetime = notAfter - notBefore;
          if (lifetime <= 0) {
            mode = "renew";
          } else {
            const elapsed = now - notBefore;
            if (elapsed / lifetime < RENEW_RATIO) {
              mode = "cache";
              cacheInfo = info;
            }
          }
        }
      } catch {
        mode = "renew";
      }
    }

    if (mode === "cache" && existing && cacheInfo) {
      return c.json({
        domain,
        key: existing.key,
        cer: existing.cer,
        ca: existing.ca,
        notAfter: cacheInfo.notAfter.toISOString(),
      });
    }

    const { zone, cred } = await resolveDnsZone(domain);

    const existingKeys =
      mode === "renew" && existing?.key && existing?.csr
        ? { key: existing.key, csr: existing.csr }
        : null;

    const result = await runAcme(
      account.acmeUrl,
      {
        privateKey: account.creds.privateKey,
        accountUrl: account.creds.accountUrl,
        eab: account.creds.eab ?? null,
      },
      domain,
      zone.name,
      cred,
      existingKeys,
    );

    if (mode === "renew" && existing) {
      await db
        .update(schema.certificates)
        .set({
          key: result.key,
          csr: result.csr,
          cer: result.cer,
          ca: result.ca,
        })
        .where(eq(schema.certificates.id, existing.id));
    } else {
      await db.insert(schema.certificates).values({
        domain,
        key: result.key,
        csr: result.csr,
        cer: result.cer,
        ca: result.ca,
        alt: [domain],
        acmeAccountId: client.acmeAccountId,
      });
    }

    const info = crypto.readCertificateInfo(result.cer);
    return c.json({
      domain,
      key: result.key,
      cer: result.cer,
      ca: result.ca,
      notAfter: info.notAfter.toISOString(),
    });
  });
