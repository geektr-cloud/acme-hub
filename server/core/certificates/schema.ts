import { z } from "zod";
import { type Equals, assert } from "tsafe";
import type { Certificate } from "@server/db/schema";

// ── field definitions ─────────────────────────────────────────────────────────

const id = z.uuid();
const privateKey = z.string();
const commonName = z.string();
const sans = z.array(z.string());
// `z.json()` 的静态类型是递归 JSON 联合，既破坏 `assert<Equals>`（drizzle 列为 unknown），
// 又会撑爆 Hono 的 RPC 类型推断——固定为 unknown。
const config = z.json() as unknown as z.ZodType<unknown>;
const chain = z.string();
const certificate_ = z.string();
const csr = z.string();
const acmeAccountId = z.uuid().nullable();
const certHash = z.string();
const renewAt = z.string().nullable();
const createdAt = z.string();
const updatedAt = z.string();

// ── base schema ───────────────────────────────────────────────────────────────

export const certificate = z.object({
  id,
  privateKey,
  commonName,
  sans,
  config,
  chain,
  certificate: certificate_,
  csr,
  acmeAccountId,
  certHash,
  renewAt,
  createdAt,
  updatedAt,
});
assert<Equals<z.infer<typeof certificate>, Certificate>>();
export type { Certificate };

export const newItem = (): Certificate => ({
  id: "",
  privateKey: "",
  commonName: "",
  sans: [],
  config: null,
  chain: "",
  certificate: "",
  csr: "",
  acmeAccountId: null,
  certHash: "",
  renewAt: null,
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
