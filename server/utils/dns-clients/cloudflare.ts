import type { CloudflareCreds } from "@server/core/dns-credentials/creds";
import type { DnsClient } from "./base";

const API_BASE = "https://api.cloudflare.com/client/v4";

export function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

interface CfApiResponse<T> {
  success: boolean;
  errors: { message: string }[];
  result: T;
}

function isCfResponse(v: unknown): v is CfApiResponse<unknown> {
  return (
    v !== null &&
    typeof v === "object" &&
    "success" in v &&
    "errors" in v &&
    "result" in v
  );
}

async function request<T>(
  creds: CloudflareCreds,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const json: unknown = await res.json();
  if (isCfResponse(json)) {
    if (!json.success) {
      throw new Error(
        `Cloudflare DNS ${json.errors[0]?.message ?? "unknown error"}`,
      );
    }
    return json.result as T;
  }
  if (!res.ok) {
    throw new Error(`Cloudflare DNS HTTP ${res.status}`);
  }
  return json as T;
}

interface CfDnsRecord {
  id: string;
  name: string;
  content: string;
  type: string;
}

export function createCloudflareDnsClient(creds: CloudflareCreds): DnsClient {
  async function findZoneId(zone: string): Promise<string> {
    const result = await request<{ id: string }[] | null>(
      creds,
      `/zones?name=${encodeURIComponent(zone)}`,
    );
    const id = result?.[0]?.id;
    if (!id) {
      throw new Error(`Cloudflare DNS zone not found: ${zone}`);
    }
    return id;
  }

  return {
    async listTxt(zone, fqdn) {
      const zoneId = await findZoneId(zone);
      const result = await request<CfDnsRecord[]>(
        creds,
        `/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(fqdn)}&per_page=100`,
      );
      if (!Array.isArray(result)) return [];
      return result
        .filter((r) => r.type === "TXT" && r.name === fqdn)
        .map((r) => ({
          id: r.id,
          fqdn: r.name,
          value: stripQuotes(r.content),
        }));
    },

    async addTxt(zone, fqdn, value) {
      const zoneId = await findZoneId(zone);
      await request<CfDnsRecord>(creds, `/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify({
          type: "TXT",
          name: fqdn,
          content: value,
          ttl: 60,
        }),
      });
    },

    async removeTxt(zone, fqdn, value) {
      const zoneId = await findZoneId(zone);
      const records = await this.listTxt(zone, fqdn);
      const matched = records.filter((r) => r.value === value);
      for (const rec of matched) {
        await request<void>(creds, `/zones/${zoneId}/dns_records/${rec.id}`, {
          method: "DELETE",
        });
      }
    },
  };
}
