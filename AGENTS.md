# AGENTS.md — acme-hub

本文件指导在 **acme-hub 目录**打开的 Claude Code。

## 项目定位

**acme-hub** 是一个真实项目：ACME 证书管理中枢。生产域名 `acme.geektr.cloud`，独立仓库 `github.com/geektr-cloud/acme-hub`。

> 当前它临时嵌在一个上层工作区里（因为它依赖的 `@acrux/*` 还没发到 npm，先以 `workspace:*` 引用源码）。这只是过渡安排，**写代码时把 acme-hub 当成一个独立的应用对待**，不需要关心上层工作区的结构。等 acrux 发布后，这些依赖会换成正常的版本号。

技术栈：单个 Cloudflare Worker = Vue 3 SPA（`dist/` 经 `ASSETS` binding 提供）+ Hono JSON API（`/api/*`）。数据用 D1（SQLite）+ Drizzle ORM。UI 文案 zh-CN。

业务实体：`acme-accounts`（ACME 账户）、`certificates`（证书）、`consumers`（消费者 = 持 token 调用本服务的外部主体）、`dns-credentials`（DNS 服务商凭据）、`domains`（域名 + 绑定的 DNS 凭据）。

辅助模块：`settings`（全局配置，KV 表 + 默认值分层）、`logs`（消费者操作审计日志）。

对外接口：`pki-v1`（`POST /pki/v1/certificates/issue`）—— 供外部消费者（Caddy 等）拉取/续期证书的公开端点，脱离 `/api` 前缀，见「架构 › 对外 PKI 端点」。

## 依赖说明（重要）

acme-hub **消费**以下来自 acrux 的能力，但**不拥有、不修改**它们：

- `@acrux/core` — 前端集合 / 异步抽象层（`useCachedCollection`、`useHonoApi`、`useAsyncState`、`useValidation`）。
- `@acrux/server` — 后端路由工厂（`createCrudRoutes` 等）+ HTTP/校验辅助（`HttpErr`、`ErrorHandler`、`paramId`、`validJson`）。
- `@/components/acrux-ui/**`（display / fields / page / actions 四组）— 通过 `shadcn-vue add @acrux/<item>` 从 registry 安装的**源码副本**。

含义：

- 需要调整 acrux 的能力（新增 hook、改工厂签名、改 acrux-ui 组件行为）时，**不要在本项目里 fork 或硬改**。先确认能否用现有 API 组合解决；确实需要改 acrux 本身，就**停下来告诉用户**（这超出 acme-hub 范围，需在 acrux 项目里处理），别在本目录绕过。
- `src/components/acrux-ui/**` 是安装来的源码副本，shadcn 模型允许装后本地微调；但**优先把它们当作上游组件**，能不改就不改，要改也只做本项目必需的小适配，并在交付时说明改了什么（方便日后 registry 升级时对账）。
- `src/components/ui/**` 是本项目自己的 shadcn 基础组件，可自由增改。

## ACME 协议栈

证书签发依赖 **`@geektr/acme-dns01`** —— 基于 publishlab/node-acme-client 的 fork，仅支持 DNS-01 挑战，原生 fetch（无 axios），Web Crypto 密钥生成。专门为 workerd 准备。

- 入口：`import { Client, crypto, directory } from "@geektr/acme-dns01"`。
- 密钥生成：`crypto.createPrivateEcdsaKey("P-256")` / `crypto.createPrivateRsaKey()` 返回 `Uint8Array`（PEM 字节流），入库前用 `TextDecoder` 转 utf-8 字符串。
- `crypto.getPublicKey` 是 **async**（acme-client v5 是 sync，别弄错）。
- HTTP 全走 native fetch。DNS 预验证走 cloudflare-pal dig 服务直查权威 NS（`DigResolver`，`server/utils/dig-resolver.ts`），避免公共递归解析器负缓存导致 `txt-miss` 死循环。`CFPAL_ENDPOINT` 环境变量可覆盖端点（默认 `https://cloudflare-pal.geektr.cloud`）。`nodejs_compat` 仍需保留（`Buffer` 等）。

更换证书相关库时优先扩展 `@geektr/acme-dns01`，不再引入 acme-client（带 axios + node-forge，Workers bundle 膨胀 700+ KB，且默认 http adapter 在 workerd 不可用）。

## 常用命令

包管理器 **pnpm**。

- `pnpm dev` — Vite + `@cloudflare/vite-plugin`，跑真实 Worker 运行时 + 本地 D1。
- `pnpm build` — `vue-tsc --build` 类型检查 + `vite build` 并行。
- `pnpm preview` — build 后用 `wrangler dev` 跑打包产物。
- `pnpm type-check` — `vue-tsc --build`。
- `pnpm lint` — `eslint --fix` 后 `prettier --write`。
- `pnpm test` / `pnpm test:run` — vitest（纯逻辑模块）。
- `pnpm deploy` — build + `wrangler deploy`（**生产部署，确认后再执行**）。
- `pnpm cf-typegen` — 由 `wrangler.jsonc` 重生成 `worker-configuration.d.ts`（勿手改该文件）。

**改完代码必跑 `pnpm type-check` + `pnpm lint`，通过后再交付。**

## 架构

### 单 Worker：SPA + API

`server/index.ts` 导出 Hono `app`（+ `AppType` 供前端 RPC）。在 `/api/{auth,acme-accounts,consumers,certificates,dns-credentials,domains,settings,logs}` 挂载管理路由模块，`/pki/v1` 挂对外证书端点（脱离 `/api`），最后 `app.get("/*", ...)` 用 `env.ASSETS` 提供 SPA。错误经 `ErrorHandler`（来自 `@acrux/server`）序列化为 `{ status, error }`。

### Auth gate

所有 `/api/*` 走签名 cookie 中间件 `server/middlewares/auth.ts`，一个例外：`/api/auth/*`（登录本身）。对外 PKI 端点挂在 `/pki/v1`（**不在 `/api` 下**），天然不经此中间件，自带 Bearer token 认证。登录 `POST /api/auth/login` 比对 `getAdminPassword()`（settings 可覆盖，空回退 `env.API_TOKEN`），用 `env.API_TOKEN` HMAC 签发 HttpOnly cookie（签名密钥恒为 `env.API_TOKEN`，与登录口令解耦）。前端 `rpc()` 拦截 401 → 跳 `/login?next=`。

**新建对外暴露的 endpoint 时**：管理端 endpoint 放 `/api/*`（自动受 auth 保护）；有意做成公开接口的，放 `/api` 之外（如 `/pki/v1`）并自带 Bearer 认证，必须显式说明并确认。

### 对外 PKI 端点（`server/core/pki/`）

对外证书供给/分发接口，非 ACME 协议（RFC 8555）——ACME 只是后端拿证书的手段，故命名为 `pki` 而非 `acme`。挂 `/pki/v1`，脱离 `/api` 前缀。三个端点，全经 `requireConsumer` Bearer 鉴权：

- `GET /pki/v1/certificates` — 列表，仅元数据（`{ id, commonName, sans, notAfter, createdAt, updatedAt }`，**不含**私钥/证书材料）。
- `GET /pki/v1/certificates/lookup?domain=` — 按域名查已有证书完整材料（只读，命中才返回）。
- `POST /pki/v1/certificates/issue` — 供给：签发/续期/回缓存。body `{ domains: string[] }`，响应 `{ commonName, sans, privateKey, certificate, chain, fullchain, notBefore, notAfter }`（`commonName` = 数组首项剥 `*.`，签发证书 SAN 含全部 domains）。`Accept: text/event-stream` 时同端点返回 SSE 进度流，否则返回 JSON。

对外 API 错误信息**全英文**（管理端 UI 文案保持 zh-CN）。

- **认证**：`middleware.ts` `requireConsumer` — `Authorization: Bearer <consumers.token>` 查库定位 consumer，注入 `c.get("consumer")`。
- **授权**：`match.ts` `allowMatch(domain, consumer.allow)` — `fulltext` 全文精确；`suffix` label 对齐后缀（`domain === pattern || domain.endsWith("." + pattern)`）；空规则拒绝；pattern 中 `*` 当普通字符。有 vitest 覆盖（`match.test.ts`）。
- **wildcard 域名**：`*.example.com` 合法，DNS-01 challenge 使用裸域名（`_acme-challenge.example.com`），`allowMatch` 按裸域名匹配 suffix 规则。
- **决策**：查同 account+commonName 最新证书。剩余寿命比例内直接回缓存；过半/过期/解析失败则续期（复用旧 privateKey+csr）；无记录则新签。缓存/续期前额外比对 SAN 集合：请求域名不是旧证书 sans 子集时强制新签（`coverage.ts`）。续期阈值来自 settings `renew_window_ratio`（默认 `config.ts` `DEFAULT_RENEW_RATIO = 0.66`），**由调用方在入口 `await getRenewWindowRatio()` 取一次注入** `decide()` / `renewAt()` / `matchCert()`——`decide.ts` 三函数保持纯（不读 DB、有单测），ratio 作参数传入。
- **执行模型**：纯 D1 + `ctx.waitUntil`（无 Cloudflare Workflow）。签发在赢得 `ResourceLock`（`server/core/resource-locks/`）的请求 handler 内跑 `runAcme`；每 attempt `runId=uuidv7()` 唯一；`CertEvent` 按 runId 隔离，SSE 按 runId tail。`certHash` 为签发去重键（同 account + 同 SAN 集合复用同一 Certificate 行）。
- **DNS-01**：`resolve.ts` `resolveDnsZone` 从 domain 逐级剥 label 匹配 `domains` 表找 zone + 绑定凭据（未注册/未绑凭据/凭据缺失 → 412）；`createDnsClient` 按 provider 分发（cloudflare / alicloud）。
- **DNS-01 ensureTxt 语义**：`ensureTxt(zone, fqdn, value, remark?)` 是**纯追加**——exact value match 则幂等返回，否则一律 `AddDomainRecord`（阿里云）/ `POST`（Cloudflare），**不 Update/PATCH**。同名多值 TXT 是 DNS 正常形态（apex + wildcard 同 FQDN 不同 keyAuth 必须并存）。`removeTxt(value)` 按值精确删除，不影响其他值。
- **签发**：`issue.ts` `runAcme` 包 `@geektr/acme-dns01` 的 `client.auto`，challenge create/remove 走 DNS client。
- **SSE 事件契约（公开）**：`schema.ts` `CertEvent` 联合类型，`started` / `decision`(mode: reuse|renew|issue) / `challenge`(status: preparing|ready|cleaning) / `issued` / `completed` / `failed`。**刻意不含**内部运维信息（DNS 凭据名、provider、内部 zone 名、ACME 账户标识、certificateId）——这是对外稳定契约，扩展时勿泄露内部细节。`message`/`reason` 英文。

### 全局配置（`server/core/settings/`）

KV 配置表 `Setting`（`key` 主键 + `value`），DB 只存**被显式覆盖**的值，空/无记录 = 未设置。业务侧读取时套默认值（分层：settings 覆盖 → 默认）。这样页面忠实反映"是否覆盖了默认"，业务侧永远有可用值。管理端 `GET/PUT /api/settings`（受 auth 保护）。

- 目录**非标准三件套**：`schema.ts`（已知 key 常量 `KEYS` + zod 对象 schema，key-value 表不与 API 对象 1:1，故**不做 `assert<Equals>` 行漂移断言**）+ `service.ts`（读写 + 分层默认，server-only）+ `routes.ts`（手写 `new Hono()`，非 CRUD）+ `index.ts`（`export * as setting from "./schema"`）。
- 已知 key：`renew_window_ratio`（默认 `pki/config.ts` `DEFAULT_RENEW_RATIO = 0.66`，`getRenewWindowRatio()` 校验 finite/>0/<1 才用，否则回退）、`admin_password`（默认 `env.API_TOKEN`，`getAdminPassword()` 空则回退）。
- **默认值单一来源**：`DEFAULT_RENEW_RATIO` 只在 `pki/config.ts` 定义，`settings/service.ts` import 复用，勿再本地复制。
- **登录口令 vs cookie 密钥解耦**：`auth/routes.ts` 登录比对 `getAdminPassword()`（可被 settings 覆盖），但签名 cookie 的 HMAC 密钥**仍恒用 `env.API_TOKEN`** 不变。
- **安全取舍**：`GET /api/settings` 会把 `admin_password` 原样回显（整个 `/api` 已在 auth 后、单管理员内部工具，接受此取舍；前端用 password 输入框呈现）。**切勿把 `admin_password` 写进任何日志。**

### 消费者操作日志（`server/core/logs/`）

审计消费者对外调用。表 `ConsumerLog`（`id`/`consumerId`/`event`/`description`/`createdAt`，追加写、不可变、无 `updatedAt`）。`event` 是英文机读 code（`certificate.list` / `certificate.issue`），`description` 是 zh-CN 人读文案（内部管理端，非对外契约）。管理端只读 `GET /api/logs?page&limit`（受 auth 保护）。

- 目录**非标准三件套**：`schema.ts`（列表项 zod，含 join 出的 `consumerName`）+ `service.ts`（`recordLog` 追加 + `listLogs` offset 分页 join `consumers` 富化）+ `routes.ts`（手写只读列表，`clampLimit`）+ `index.ts`（`export * as log`）。**不套 CRUD 工厂**（工厂强制 create/upsert schema，read-only 不合适）。
- **记录点 = 两个 `/pki/v1` 端点**（`pki/routes.ts` handler 内，用 `c.executionCtx.waitUntil(recordLog(...))` 异步写，不阻塞主响应、失败不影响 PKI 主流程）：`GET /pki/v1/certificates` → `certificate.list`；`POST /pki/v1/certificates/issue` → `certificate.issue`（description 含域名）。`lookup` 不记录。
- consumer 可能已删 → `listLogs` leftJoin 得 `consumerName = null`，前端显示"（已删除）"不报错。

### 每实体三件套（`server/core/<entity>/`）

```
server/core/<entity>/
  schema.ts   ← zod 4 schema + drizzle 类型 assert + newItem + api schema（前后端共用）
  routes.ts   ← Hono 路由（server-only，import @server/db）
  index.ts    ← export * as <entity> from "./schema";   （client-safe barrel）
```

**铁律：`index.ts` 绝不可 re-export `routes.ts`** — 否则把 `cloudflare:workers` 拖进 SPA bundle。路由在 `server/index.ts` 里走显式 `@server/core/<entity>/routes` 路径导入。

`schema.ts` 结构：字段定义 → 基础 `z.object`（与 drizzle `$inferSelect` 1:1）→ `assert<Equals<...>>`（tsafe，漂移即编译失败）→ `export type` → `newItem()` 空表单初始化 → `create.body` / `upsert.body`（omit id+时间戳）。

`routes.ts` 用 `@acrux/server` 工厂（注入 `db`）：

```ts
import { desc } from "drizzle-orm";
import { db, schema } from "@server/db";
import { createCrudRoutes } from "@acrux/server";
import * as certificateSchema from "./schema";

export const certificateRoutes = createCrudRoutes({
  db,
  table: schema.certificates,
  create: certificateSchema.create.body,
  upsert: certificateSchema.upsert.body,
  notFound: "Certificate not found",
  orderBy: (t) => [desc(t.createdAt)],
});
```

非标准 endpoint 手写 `new Hono()`，错误 `throw HttpErr(status, msg)`。

**写路径有副作用 / 默认字段注入**：用 `@acrux/server` 工厂的生命周期 hook，不要拆出工厂。可用 hook（均接 `CrudBaseOptions`）：

- `beforeCreate(data, db)` / `beforeUpdate(id, data, db)` — 写库**前**。返回 `Partial<TCreate>` 浅合并入写库 payload（用于注入 token、tenantId、`creds` 这类默认/派生字段）；返回 `void` 则不改 payload；抛错则中止。
- `afterCreate(row, db)` / `afterUpdate(row, db)` / `afterDelete(row, db)` — 写库**后**事后副作用。
- `beforeDelete(id, db)` — 删除前级联清理 / 置空悬挂引用。
- 三个列表工厂额外有 `serialize(rows) => Out[]`：批量后处理列表行（join 富化等，签名批量以避免 N+1）。

例：`server/core/acme-accounts/routes.ts` 仍手写 6 端点（早期工厂无 `beforeCreate` 时的遗留写法，写路径落库前调 `ensureRegistered` 生成/注册密钥对）。等效折叠：

```ts
export const acmeAccountRoutes = createCrudRoutes({
  db, table: schema.acmeAccounts,
  create: acmeAccountSchema.create.body, upsert: acmeAccountSchema.upsert.body,
  notFound: "ACME account not found",
  orderBy: (t) => [desc(t.createdAt)],
  beforeCreate: async (data) => ({ creds: await ensureRegistered(data) }),
  beforeUpdate: async (_id, data) => ({ creds: await ensureRegistered(data) }),
  beforeDelete: async (id, db) => {
    await db.update(schema.consumers).set({ acmeAccountId: null }).where(eq(schema.consumers.acmeAccountId, id));
    await db.update(schema.certificates).set({ acmeAccountId: null }).where(eq(schema.certificates.acmeAccountId, id));
  },
});
```

新实体直接用工厂 + hook；不要新写"例外"的手写 6 端点。**真正必须手写的场景**：非 JSON 请求 / 响应（multipart、二进制、Range、SSE）、非 CRUD 形态（webhook、批处理、代理）。这些用 `crudBase` 续接或裸 `new Hono()`，复用 `paginatedList` / `cursorList` / `paramId` / `HttpErr` / `clampLimit` / `validJson` 等 primitives。

### 前端（`src/`）

- `main.ts` 接 Pinia、Vue Router、`vue-final-modal`。
- 别名：`@/*` → `src/*`，`@server/*` → `server/*`。**`src/` 里只能 `import type` from `@server/*`**，值导入会把 `cloudflare:workers` 拖进 SPA bundle。
- API：`client = hc<AppType>("/")`（`@/utils/api`），调用包一层 `useHonoApi`。
- 实体类型从 `@server/core/<entity>` namespace 取（`<entity>.<Entity>`、`<entity>.upsert.body`、`<entity>.newItem`）。
- 路由守卫查 `useAuthStore().authenticated`，未登录跳 `/login?next=`。

### Store（`src/stores/<entity>.ts`，一行式）

```ts
import { certificate } from "@server/core/certificates";
import { useHonoApi, useCachedCollection } from "@acrux/core";
import { client } from "@/utils/api";
import { defineStore } from "pinia";

export const useCertificateStore = defineStore("certificates", () =>
  useCachedCollection({
    newItem: certificate.newItem,
    maxAge: 30_000,
    fetchFn: useHonoApi(() => client.api.certificates.$get()),
    removeFn: useHonoApi((id: string) =>
      client.api.certificates[":id"].$delete({ param: { id } }),
    ),
    upsertFn: useHonoApi((json: certificate.Certificate) =>
      client.api.certificates.$put({ json }),
    ),
    upsertSchema: certificate.upsert.body,
  }),
);
```

hook 返回**元组**（非对象访问器）：`const [items, status, refresh] = useAll()`、`const [form, issues, status, submit] = useUpsert(idRef)`。

## 数据库 / Drizzle

schema 在 `server/db/schema.ts`（drizzle `sqliteTable`），类型经 `$inferSelect` / `$inferInsert` 派生。统一 `import { db, schema } from "@server/db"`。

**改 schema 流程**：改 `server/db/schema.ts` → 同步 `server/core/<entity>/schema.ts`（`assert<Equals>` 防漂移）→ `pnpm drizzle-kit generate` → `wrangler d1 execute main --local --file=drizzle/<migration>/migration.sql` → 部署前同命令 `--remote` → `pnpm type-check`。

约定：ID 用应用层生成的 UUIDv7（`uuidv7()`，时间有序）；时间戳 DB 侧生成（`strftime('%Y-%m-%dT%H:%M:%fZ','now')`，唯一给出严格毫秒 ISO 的格式）。`updatedAt` 配 `$onUpdate`（仅 `db.update()` 触发，裸 SQL 不触发）。

SQLite 注意：`ADD COLUMN ... NOT NULL DEFAULT '<lit>'` 支持；改列默认值不能原地 ALTER，迁移须 `CREATE TABLE 新 → INSERT…SELECT → DROP → RENAME` 并重建唯一索引。

## 约定

- **zod 4**：用 `z.uuid()`（非 `z.string().uuid()`）、`z.json()`（非 `z.unknown()`）；UI 里持有原始 JSON 文本的字段才用 `z.string().refine(isValidJson)`。前端表单经 Standard Schema 校验，由 `useValidation`（`useUpsert` 元组的 `issues`）暴露。
- **TS**：`noUncheckedIndexedAccess` 开启，索引访问得 `T | undefined`，处理 undefined 分支。
- **shadcn**：`shadcn-vue add` 或手改 `src/components/ui/**` 后**立刻 `pnpm lint`**，把 shadcn 的格式重写折叠掉，避免几十个文件冒出纯格式 diff。
- **Vue 组件名**多词（`vue/multi-word-component-names`，由文件名推导）；`src/components/ui/**` 被 lint ignore，故 shadcn 基础组件可单词名。
- **依赖增删**用 `pnpm add/uninstall`（同步 package.json + lockfile），别手改 package.json 再 install，除非有 CLI 表达不了的理由并说明。
- **生成文件勿手改**：`worker-configuration.d.ts`（`pnpm cf-typegen` 重生成）、`drizzle/` 迁移 SQL（drizzle-kit 生成）。
- **git**：本项目独立仓库（remote `geektr-cloud/acme-hub`）。提交/推送仅在用户明确要求时进行；新分支推送，别直接推 main。

## Wrangler bindings

- `DB` — D1 数据库 `main`（本地 dev 用占位 id）。
- `kv` — KV namespace（占位 id，备用缓存）。
- `ASSETS` — `./dist` 静态资源。
- Secret `API_TOKEN` — 管理登录口令，同时是 auth 签名 cookie 的 HMAC 密钥。
- `vars.CFPAL_ENDPOINT` — cloudflare-pal dig 服务端点（`DigResolver` 用）。`wrangler.jsonc` 中设为空串（类型占位），`.env.local` 覆盖实际值（不设则用默认 `https://cloudflare-pal.geektr.cloud`）。注意代码中必须用 `||` 而非 `??` 做 fallback（空串不是 nullish）。
- 加 binding：改 `wrangler.jsonc` → `pnpm cf-typegen` 刷新 `worker-configuration.d.ts`。
