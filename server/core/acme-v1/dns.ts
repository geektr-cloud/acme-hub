import { eq } from "drizzle-orm";
import { HttpErr } from "@acrux/server";
import { db, schema } from "@server/db";
import type { DnsCredential } from "@server/db/schema";
import type { CloudflareCreds } from "@server/core/dns-credentials/creds";

export interface DnsProvider {
  add(zoneName: string, name: string, value: string): Promise<void>;
  remove(zoneName: string, name: string, value: string): Promise<void>;
}

function makeCloudflareProvider(creds: CloudflareCreds): DnsProvider {
  const apiToken = creds.apiToken;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  async function findZoneId(zoneName: string): Promise<string> {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName)}`,
      { headers },
    );
    const json = (await res.json()) as {
      success: boolean;
      errors?: { message: string }[];
      result?: { id: string }[];
    };
    if (!json.success) {
      throw HttpErr(
        502,
        `Cloudflare API: ${json.errors?.[0]?.message ?? "unknown error"}`,
      );
    }
    if (json.result && json.result.length > 0) return json.result[0]!.id;
    throw HttpErr(502, `Cloudflare: 找不到 zone ${zoneName}`);
  }

  return {
    async add(zoneName, name, value) {
      const zoneId = await findZoneId(zoneName);
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ type: "TXT", name, content: value, ttl: 60 }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        errors?: { message: string }[];
      };
      if (!json.success) {
        throw HttpErr(
          502,
          `Cloudflare DNS 写入失败: ${json.errors?.[0]?.message ?? "unknown error"}`,
        );
      }
    },
    async remove(zoneName, name, value) {
      const zoneId = await findZoneId(zoneName);
      const listRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(name)}&content=${encodeURIComponent(value)}`,
        { headers },
      );
      const listJson = (await listRes.json()) as {
        success: boolean;
        result?: { id: string }[];
      };
      if (!listJson.success || !listJson.result) {
        console.warn("Cloudflare DNS 查询待删记录失败", name);
        return;
      }
      for (const rec of listJson.result) {
        await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${rec.id}`,
          { method: "DELETE", headers },
        );
      }
    },
  };
}

export function makeProvider(cred: DnsCredential): DnsProvider {
  if (cred.provider === "cloudflare")
    return makeCloudflareProvider(cred.creds as CloudflareCreds);
  if (cred.provider === "alicloud") throw HttpErr(501, "alicloud 暂未实现");
  throw HttpErr(500, "未知 DNS provider");
}

export async function resolveDnsZone(
  domain: string,
): Promise<{ zone: typeof schema.domains.$inferSelect; cred: DnsCredential }> {
  const parts = domain.split(".");
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
