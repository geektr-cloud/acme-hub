import { z } from "zod";
import { type Equals, assert } from "tsafe";
import type { DnsCredential } from "@server/db/schema";
import { provider, credsSchema, refineCreds } from "./creds";

export type { Provider, Creds, CloudflareCreds, AlicloudCreds } from "./creds";

// ── field definitions ─────────────────────────────────────────────────────────

const id = z.uuid();
const name = z.string().nonempty("名称不能为空");
const description = z.string();
const createdAt = z.string();
const updatedAt = z.string();

// ── base schema ───────────────────────────────────────────────────────────────

export const dnsCredential = z.object({
  id,
  name,
  description,
  provider,
  creds: credsSchema,
  createdAt,
  updatedAt,
});
assert<Equals<z.infer<typeof dnsCredential>, DnsCredential>>();
export type { DnsCredential };

export const newItem = (): DnsCredential => ({
  id: "",
  name: "",
  description: "",
  provider: "cloudflare",
  creds: null,
  createdAt: "",
  updatedAt: "",
});

// ── api schemas ───────────────────────────────────────────────────────────────

export const create = {
  body: dnsCredential
    .omit({ id: true, createdAt: true, updatedAt: true })
    .superRefine((v, ctx) => refineCreds(v, ctx)),
};

export const upsert = {
  body: dnsCredential
    .extend({ id: z.union([id, z.literal("")]).optional() })
    .omit({ createdAt: true, updatedAt: true })
    .superRefine((v, ctx) => refineCreds(v, ctx)),
};
