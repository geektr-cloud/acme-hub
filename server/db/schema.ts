import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

// ISO-8601 timestamp from SQLite (e.g. 2026-06-16T07:44:08.123Z)
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// ACME 账户：对接 CA（Let's Encrypt / ZeroSSL 等）的账户与密钥。
export const acmeAccounts = sqliteTable("AcmeAccount", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  email: text("email").notNull().default(""),
  // CA 的 ACME directory URL。
  acmeUrl: text("acmeUrl").notNull().default(""),
  // 凭据合集（敏感）。打包 ACME 账户密钥对 + 账户资源 URL，以及 EAB（ZeroSSL 等需要）。
  // { privateKey, publicKey, accountUrl, eab: { kid, hmacKey } | null }，各字段可选。null = 未签发/未注册。
  creds: text("creds", { mode: "json" }).$type<{
    privateKey?: string;
    publicKey?: string;
    accountUrl?: string;
    eab?: { kid: string; hmacKey: string } | null;
  } | null>(),
  createdAt: text("createdAt").notNull().default(now),
  updatedAt: text("updatedAt")
    .notNull()
    .default(now)
    .$onUpdate(() => now),
});

export type AcmeAccount = typeof acmeAccounts.$inferSelect;
export type NewAcmeAccount = typeof acmeAccounts.$inferInsert;

// 客户端：持 token 调用本服务的消费方，allow 限定其可申请的域名范围。
export const clients = sqliteTable(
  "Client",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    // 调用凭据。
    token: text("token").notNull().default(""),
    // 域名匹配规则：{ type: "fulltext"(全文精确) | "suffix"(后缀), pattern }[]。
    allow: text("allow", { mode: "json" })
      .notNull()
      .default(sql`'[]'`)
      .$type<{ type: "fulltext" | "suffix"; pattern: string }[]>(),
    // 该客户端绑定的 ACME 账户。null = 未绑定。不加外键约束，删除账户时由应用层置空。
    acmeAccountId: text("acmeAccountId"),
    createdAt: text("createdAt").notNull().default(now),
    updatedAt: text("updatedAt")
      .notNull()
      .default(now)
      .$onUpdate(() => now),
  },
  (t) => [index("Client_acmeAccountId_idx").on(t.acmeAccountId)],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

// 证书：业务流程（向 CA 签发）生成的对象，UI 只读。
export const certificates = sqliteTable(
  "Certificate",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    // 证书私钥（PEM）。
    key: text("key").notNull().default(""),
    // 主域名 + 备用域名（SAN）。
    domain: text("domain").notNull().default(""),
    alt: text("alt", { mode: "json" })
      .notNull()
      .default(sql`'[]'`)
      .$type<string[]>(),
    // 签发所需的配置信息（CA 特定参数等）。任意 JSON，可为 null。
    config: text("config", { mode: "json" }).$type<unknown>(),
    // CA 证书链 / 叶子证书 / CSR（PEM）。
    ca: text("ca").notNull().default(""),
    cer: text("cer").notNull().default(""),
    csr: text("csr").notNull().default(""),
    // 签发该证书的 ACME 账户。null = 未关联。
    acmeAccountId: text("acmeAccountId"),
    createdAt: text("createdAt").notNull().default(now),
    updatedAt: text("updatedAt")
      .notNull()
      .default(now)
      .$onUpdate(() => now),
  },
  (t) => [index("Certificate_acmeAccountId_idx").on(t.acmeAccountId)],
);

export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
