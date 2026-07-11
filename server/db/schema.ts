import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
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

// 消费者：持 token 调用本服务的外部主体，allow 限定其可申请的域名范围。
export const consumers = sqliteTable(
  "Consumer",
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
    // 该消费者绑定的 ACME 账户。null = 未绑定。不加外键约束，删除账户时由应用层置空。
    acmeAccountId: text("acmeAccountId"),
    createdAt: text("createdAt").notNull().default(now),
    updatedAt: text("updatedAt")
      .notNull()
      .default(now)
      .$onUpdate(() => now),
  },
  (t) => [index("Consumer_acmeAccountId_idx").on(t.acmeAccountId)],
);

export type Consumer = typeof consumers.$inferSelect;
export type NewConsumer = typeof consumers.$inferInsert;

// 证书：业务流程（向 CA 签发）生成的对象，UI 只读。
export const certificates = sqliteTable(
  "Certificate",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    // 证书私钥（PEM）。
    privateKey: text("privateKey").notNull().default(""),
    // 通用名称（primary domain）。
    commonName: text("commonName").notNull().default(""),
    // Subject Alternative Names。
    sans: text("sans", { mode: "json" })
      .notNull()
      .default(sql`'[]'`)
      .$type<string[]>(),
    // 签发所需的配置信息（CA 特定参数等）。任意 JSON，可为 null。
    config: text("config", { mode: "json" }).$type<unknown>(),
    // 中间证书链 PEM。
    chain: text("chain").notNull().default(""),
    // 叶子证书 PEM。
    certificate: text("certificate").notNull().default(""),
    // CSR（PEM）。
    csr: text("csr").notNull().default(""),
    // 签发该证书的 ACME 账户。null = 未关联。
    acmeAccountId: text("acmeAccountId"),
    // 签发去重键：同 account + 同 SAN 集合复用同一 Certificate 行。
    certHash: text("certHash").notNull().default(""),
    createdAt: text("createdAt").notNull().default(now),
    updatedAt: text("updatedAt")
      .notNull()
      .default(now)
      .$onUpdate(() => now),
  },
  (t) => [
    index("Certificate_acmeAccountId_idx").on(t.acmeAccountId),
    uniqueIndex("Certificate_certHash_uniq")
      .on(t.certHash)
      .where(sql`certHash != ''`),
  ],
);

export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;

// DNS 凭据：用于操作 DNS API（签发证书时自动完成 DNS-01 验证）。
export const dnsCredentials = sqliteTable("DnsCredential", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  // DNS 服务商标识，用作 creds 的判别字段。
  provider: text("provider")
    .notNull()
    .default("cloudflare")
    .$type<"cloudflare" | "alicloud">(),
  // 凭据（敏感）。按 provider 形态不同：cloudflare = { apiToken }，alicloud = { accessKeyId, accessKeySecret }。null = 未填。
  creds: text("creds", { mode: "json" }).$type<
    | { apiToken: string }
    | { accessKeyId: string; accessKeySecret: string }
    | null
  >(),
  createdAt: text("createdAt").notNull().default(now),
  updatedAt: text("updatedAt")
    .notNull()
    .default(now)
    .$onUpdate(() => now),
});

export type DnsCredential = typeof dnsCredentials.$inferSelect;
export type NewDnsCredential = typeof dnsCredentials.$inferInsert;

// 域名：需要签发证书的域名，绑定 DNS 凭据以完成 DNS-01 验证。
export const domains = sqliteTable(
  "Domain",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    // 绑定的 DNS 凭据。null = 未绑定（暂不可用于签发）。不加外键约束，删除凭据时由应用层置空。
    dnsCredentialId: text("dnsCredentialId"),
    createdAt: text("createdAt").notNull().default(now),
    updatedAt: text("updatedAt")
      .notNull()
      .default(now)
      .$onUpdate(() => now),
  },
  (t) => [index("Domain_dnsCredentialId_idx").on(t.dnsCredentialId)],
);

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;

// 资源锁：签发流程的域名级互斥锁，防止并发签发同一域名。
export const resourceLocks = sqliteTable("ResourceLock", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  remark: text("remark").notNull().default(""),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull().default(now),
});

export type ResourceLock = typeof resourceLocks.$inferSelect;
export type NewResourceLock = typeof resourceLocks.$inferInsert;

// 签发事件日志：供 SSE tail 推流签发进度。
export const certEvents = sqliteTable(
  "CertEvent",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    runId: text("runId").notNull().default(""),
    certHash: text("certHash").notNull(),
    event: text("event", { mode: "json" }).notNull().$type<{
      type: string;
      message?: string;
      [key: string]: unknown;
    }>(),
    createdAt: text("createdAt").notNull().default(now),
  },
  (t) => [
    index("CertEvent_runId_idx").on(t.runId),
    index("CertEvent_certHash_idx").on(t.certHash),
  ],
);

export type CertEvent = typeof certEvents.$inferSelect;
export type NewCertEvent = typeof certEvents.$inferInsert;
