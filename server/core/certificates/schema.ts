import { z } from "zod";
import { type Equals, assert } from "tsafe";
import type { Certificate } from "@server/db/schema";

// ── field definitions ─────────────────────────────────────────────────────────

const id = z.uuid();
const key = z.string();
const domain = z.string();
const alt = z.array(z.string());
// `z.json()` 的静态类型是递归 JSON 联合，既破坏 `assert<Equals>`（drizzle 列为 unknown），
// 又会撑爆 Hono 的 RPC 类型推断——固定为 unknown。
const config = z.json() as unknown as z.ZodType<unknown>;
const ca = z.string();
const cer = z.string();
const csr = z.string();
const acmeAccountId = z.uuid().nullable();
const createdAt = z.string();
const updatedAt = z.string();

// ── base schema ───────────────────────────────────────────────────────────────

export const certificate = z.object({
  id,
  key,
  domain,
  alt,
  config,
  ca,
  cer,
  csr,
  acmeAccountId,
  createdAt,
  updatedAt,
});
assert<Equals<z.infer<typeof certificate>, Certificate>>();
export type { Certificate };

export const newItem = (): Certificate => ({
  id: "",
  key: "",
  domain: "",
  alt: [],
  config: null,
  ca: "",
  cer: "",
  csr: "",
  acmeAccountId: null,
  createdAt: "",
  updatedAt: "",
});

// ── api schemas ───────────────────────────────────────────────────────────────
// 证书由签发流程生成，UI 只读；这些 body 供未来的签发逻辑写入使用。

export const create = {
  body: certificate.omit({ id: true, createdAt: true, updatedAt: true }),
};

export const upsert = {
  body: certificate
    .extend({ id: z.union([id, z.literal("")]).optional() })
    .omit({ createdAt: true, updatedAt: true }),
};
