import { eq } from "drizzle-orm";
import { HttpErr } from "@acrux/server";
import { db, schema } from "@server/db";
import type { DnsCredential } from "@server/db/schema";

export async function resolveDnsZone(
  domain: string,
): Promise<{ zone: typeof schema.domains.$inferSelect; cred: DnsCredential }> {
  const bare = domain.startsWith("*.") ? domain.slice(2) : domain;
  const parts = bare.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const name = parts.slice(i).join(".");
    const [zone] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.name, name))
      .limit(1);
    if (zone) {
      if (!zone.dnsCredentialId) throw HttpErr(412, "域名未配置 DNS 凭据");
      const [cred] = await db
        .select()
        .from(schema.dnsCredentials)
        .where(eq(schema.dnsCredentials.id, zone.dnsCredentialId))
        .limit(1);
      if (!cred) throw HttpErr(412, "DNS 凭据不存在");
      return { zone, cred };
    }
  }
  throw HttpErr(412, "域名未在系统中注册");
}
