import { z } from "zod";
import { type Equals, assert } from "tsafe";
import type { AcmeAccount } from "@server/db/schema";

// ── field definitions ─────────────────────────────────────────────────────────

const id = z.uuid();
const name = z.string().nonempty("名称不能为空");
const description = z.string();
const email = z.email("邮箱格式不正确").or(z.literal(""));
const acmeUrl = z.string();
// 凭据合集（敏感）。打包 ACME 账户密钥对 + 账户资源 URL + EAB（ZeroSSL 等需要）。null = 未签发/未注册。
const creds = z
  .object({
    privateKey: z.string().optional(),
    publicKey: z.string().optional(),
    accountUrl: z.string().optional(),
    eab: z
      .object({ kid: z.string(), hmacKey: z.string() })
      .nullable()
      .optional(),
  })
  .nullable();
const createdAt = z.string();
const updatedAt = z.string();

// ── base schema ───────────────────────────────────────────────────────────────

export const acmeAccount = z.object({
  id,
  name,
  description,
  email,
  acmeUrl,
  creds,
  createdAt,
  updatedAt,
});
assert<Equals<z.infer<typeof acmeAccount>, AcmeAccount>>();
export type { AcmeAccount };
export type Creds = NonNullable<z.infer<typeof creds>>;

export const newItem = (): AcmeAccount => ({
  id: "",
  name: "",
  description: "",
  email: "",
  acmeUrl: "https://acme-v02.api.letsencrypt.org/directory",
  creds: null,
  createdAt: "",
  updatedAt: "",
});

// ── api schemas ───────────────────────────────────────────────────────────────

export const create = {
  body: acmeAccount.omit({ id: true, createdAt: true, updatedAt: true }),
};

export const upsert = {
  body: acmeAccount
    .extend({ id: z.union([id, z.literal("")]).optional() })
    .omit({ createdAt: true, updatedAt: true }),
};
