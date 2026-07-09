import type { AlicloudCreds } from "@server/core/dns-credentials/creds";
import type { DnsClient, TxtRecord } from "./base";
import { fqdnToRr } from "./base";

const ENDPOINT = "https://alidns.aliyuncs.com/";
const API_VERSION = "2015-01-09";

function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

async function sign(
  params: Record<string, string>,
  secret: string,
): Promise<string> {
  const sorted = Object.keys(params).sort();
  const canonicalizedQuery = sorted
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join("&");
  const stringToSign = `GET&%2F&${percentEncode(canonicalizedQuery)}`;
  const key = new TextEncoder().encode(secret + "&");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(stringToSign),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

class AliyunDnsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(`Aliyun DNS ${code}: ${message}`);
    this.name = "AliyunDnsError";
    this.code = code;
  }
}

async function request(
  creds: AlicloudCreds,
  action: string,
  extraParams: Record<string, string> = {},
): Promise<unknown> {
  const params: Record<string, string> = {
    Format: "JSON",
    Version: API_VERSION,
    AccessKeyId: creds.accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Action: action,
    ...extraParams,
  };
  const signature = await sign(params, creds.accessKeySecret);
  const qs = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join("&");
  const url = `${ENDPOINT}?${qs}&Signature=${percentEncode(signature)}`;
  const res = await fetch(url);
  const json: unknown = await res.json();
  if (
    json !== null &&
    typeof json === "object" &&
    "Code" in json &&
    typeof (json as { Code: unknown }).Code === "string"
  ) {
    const { Code, Message } = json as { Code: string; Message: string };
    throw new AliyunDnsError(Code, Message ?? "Unknown error");
  }
  if (!res.ok) {
    throw new Error(`Aliyun DNS HTTP ${res.status}`);
  }
  return json;
}

interface AliyunRecord {
  RecordId: string;
  RR: string;
  DomainName: string;
  Value: string;
  Type: string;
  Remark?: string;
}

function isRecordArray(v: unknown): v is AliyunRecord[] {
  return (
    Array.isArray(v) &&
    v.every(
      (r) =>
        r !== null &&
        typeof r === "object" &&
        "RecordId" in r &&
        "RR" in r &&
        "Value" in r,
    )
  );
}

export function createAliyunDnsClient(creds: AlicloudCreds): DnsClient {
  return {
    async listTxt(zone, fqdn): Promise<TxtRecord[]> {
      const rr = fqdnToRr(zone, fqdn);
      const json = await request(creds, "DescribeDomainRecords", {
        DomainName: zone,
        RRKeyWord: rr,
        TypeKeyWord: "TXT",
        PageSize: "100",
      });
      const records =
        json !== null &&
        typeof json === "object" &&
        "DomainRecords" in json &&
        (json as { DomainRecords: unknown }).DomainRecords !== null &&
        typeof (json as { DomainRecords: unknown }).DomainRecords ===
          "object" &&
        "Record" in
          (json as { DomainRecords: { Record: unknown } }).DomainRecords
          ? (json as { DomainRecords: { Record: unknown } }).DomainRecords
              .Record
          : undefined;
      if (!isRecordArray(records)) return [];
      return records
        .filter((r) => r.RR === rr && r.Type === "TXT")
        .map((r) => ({
          id: r.RecordId,
          fqdn: r.RR === "@" ? zone : `${r.RR}.${zone}`,
          value: r.Value,
          remark: r.Remark ?? undefined,
        }));
    },

    async ensureTxt(zone, fqdn, value, remark) {
      const rr = fqdnToRr(zone, fqdn);
      const existing = await this.listTxt(zone, fqdn);
      if (existing.some((r) => r.value === value)) return;
      await request(creds, "AddDomainRecord", {
        DomainName: zone,
        RR: rr,
        Type: "TXT",
        Value: value,
        TTL: "600",
        ...(remark ? { Remark: remark } : {}),
      });
    },

    async removeTxt(zone, fqdn, value) {
      const records = await this.listTxt(zone, fqdn);
      const matched = records.filter((r) => r.value === value);
      for (const rec of matched) {
        await request(creds, "DeleteDomainRecord", {
          RecordId: rec.id,
        });
      }
    },
  };
}
