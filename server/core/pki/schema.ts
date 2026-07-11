import { z } from "zod";

const domain = z
  .string()
  .min(1, "domain must not be empty")
  .regex(/^[a-zA-Z0-9.*-]+\.[a-zA-Z]{2,}$/, "invalid domain format");

export const cert = {
  body: z.object({
    domains: z
      .array(domain)
      .min(1, "at least one domain parameter is required"),
  }),
  response: z.object({
    commonName: z.string(),
    sans: z.array(z.string()),
    privateKey: z.string(),
    certificate: z.string(),
    chain: z.string(),
    fullchain: z.string(),
    notBefore: z.string(),
    notAfter: z.string(),
  }),
};

export type CertResult = z.infer<typeof cert.response>;

export const certList = {
  response: z.object({
    certs: z.array(
      z.object({
        id: z.string(),
        commonName: z.string(),
        sans: z.array(z.string()),
        notAfter: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    ),
  }),
};

export type CertListItem = z.infer<typeof certList.response>["certs"][number];

export type CertEvent =
  | { type: "started"; commonName: string; sans: string[] }
  | { type: "decision"; mode: "reuse" | "renew" | "issue"; reason: string }
  | {
      type: "challenge";
      domain: string;
      status: "preparing" | "ready" | "cleaning";
    }
  | { type: "issued"; notBefore: string; notAfter: string }
  | { type: "completed"; result: CertResult }
  | { type: "failed"; status: number; message: string };

export type CertEmit = (e: CertEvent) => void | Promise<void>;
