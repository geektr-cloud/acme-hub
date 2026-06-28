import { z } from "zod";
import { type Equals, assert } from "tsafe";
import type { Domain } from "@server/db/schema";

// ── field definitions ─────────────────────────────────────────────────────────

const id = z.uuid();
const name = z
  .string()
  .nonempty("域名不能为空")
  .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "域名格式不正确");
const description = z.string();
const dnsCredentialId = z.uuid().nullable();
const createdAt = z.string();
const updatedAt = z.string();

// ── base schema ───────────────────────────────────────────────────────────────

export const domain = z.object({
  id,
  name,
  description,
  dnsCredentialId,
  createdAt,
  updatedAt,
});
assert<Equals<z.infer<typeof domain>, Domain>>();
export type { Domain };

export const newItem = (): Domain => ({
  id: "",
  name: "",
  description: "",
  dnsCredentialId: null,
  createdAt: "",
  updatedAt: "",
});

// ── api schemas ───────────────────────────────────────────────────────────────

export const create = {
  body: domain.omit({ id: true, createdAt: true, updatedAt: true }),
};

export const upsert = {
  body: domain
    .extend({ id: z.union([id, z.literal("")]).optional() })
    .omit({ createdAt: true, updatedAt: true }),
};
