import { z } from "zod";
import { type Equals, assert } from "tsafe";
import type { Consumer } from "@server/db/schema";

// ── field definitions ─────────────────────────────────────────────────────────

const id = z.uuid();
const name = z.string().nonempty("名称不能为空");
const description = z.string();
const token = z.string();
const allowRule = z.object({
  type: z.enum(["fulltext", "suffix"]),
  pattern: z.string().nonempty("匹配模式不能为空"),
});
const allow = z.array(allowRule);
const acmeAccountId = z.uuid().nullable();
const createdAt = z.string();
const updatedAt = z.string();

// ── base schema ───────────────────────────────────────────────────────────────

export const consumer = z.object({
  id,
  name,
  description,
  token,
  allow,
  acmeAccountId,
  createdAt,
  updatedAt,
});
assert<Equals<z.infer<typeof consumer>, Consumer>>();
export type { Consumer };
export type AllowRule = z.infer<typeof allowRule>;

export const newItem = (): Consumer => ({
  id: "",
  name: "",
  description: "",
  token: "",
  allow: [],
  acmeAccountId: null,
  createdAt: "",
  updatedAt: "",
});

// ── api schemas ───────────────────────────────────────────────────────────────

export const create = {
  body: consumer
    .omit({ id: true, createdAt: true, updatedAt: true })
    .extend({ token: z.string().optional() }),
};

export const upsert = {
  body: consumer
    .extend({ id: z.union([id, z.literal("")]).optional() })
    .omit({ createdAt: true, updatedAt: true }),
};
