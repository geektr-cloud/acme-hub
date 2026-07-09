import { z } from "zod";

const domain = z
  .string()
  .min(1, "domain 不能为空")
  .regex(/^[a-zA-Z0-9.*-]+\.[a-zA-Z]{2,}$/, "域名格式不正确");

export const cert = {
  body: z.object({ domains: z.array(domain).min(1, "至少需要一个域名") }),
  response: z.object({
    domain: z.string(),
    key: z.string(),
    cer: z.string(),
    ca: z.string(),
    notAfter: z.string(),
  }),
};

export type CertResult = z.infer<typeof cert.response>;

export type CertEvent =
  | { type: "start"; domains: string[]; client: string }
  | {
      type: "allow-matched";
      domain: string;
      rule: { type: string; pattern: string };
    }
  | { type: "account"; id: string; name: string; acmeUrl: string }
  | { type: "decision"; mode: "cache" | "renew" | "issue"; reason: string }
  | { type: "cache-hit"; notAfter: string }
  | {
      type: "zone";
      domain: string;
      zone: string;
      credential: string;
      provider: string;
    }
  | { type: "keygen"; reused: boolean }
  | { type: "dns-add"; fqdn: string }
  | { type: "dns-remove"; fqdn: string }
  | { type: "acme-progress"; event: string; detail: Record<string, unknown> }
  | { type: "issued"; notAfter: string }
  | { type: "saved"; certificateId: string; mode: "renew" | "issue" }
  | { type: "done"; result: CertResult }
  | { type: "error"; status: number; message: string };

export type CertEmit = (e: CertEvent) => void | Promise<void>;
