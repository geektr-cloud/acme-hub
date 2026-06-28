# acme-hub

ACME 证书管理中枢。Cloudflare Worker 单体应用，Vue 3 SPA + Hono JSON API。

生产域名：`acme.geektr.cloud`。UI 文案 zh-CN。

## 能干啥

- 管理 ACME 账户（Let's Encrypt / ZeroSSL / Google / 自定义 CA），凭据缺失时自动生成 ECDSA 密钥对并向 CA 注册账户。
- 管理证书与客户端实体（DNS-01 签发流程基于 [`@geektr/acme-dns01`](https://www.npmjs.com/package/@geektr/acme-dns01)）。
- 管理 DNS 凭据（Cloudflare / 阿里云）与待签发域名，为后续 DNS-01 自动签发铺路。
- 单 Worker 部署：API + SPA + D1 一把梭，无外部服务依赖。

## 技术栈

| 层      | 选型                                                           |
| ------- | -------------------------------------------------------------- |
| Runtime | Cloudflare Workers（`workerd`，`nodejs_compat` 仅做兜底）      |
| API     | Hono 4 + `@hono/zod-validator` + zod 4                         |
| DB      | D1（SQLite）+ Drizzle ORM（`1.0.0-rc.3`）                      |
| ACME    | `@geektr/acme-dns01`（DNS-01 only，native fetch，Web Crypto）  |
| SPA     | Vue 3 + Pinia + Vue Router + Tailwind 4 + shadcn-vue + reka-ui |
| ID      | UUIDv7（应用层 `uuid` 包生成，时间有序）                       |

## 跑起来

需要 pnpm 与 Node `^20.19` 或 `>=22.12`。

```bash
pnpm install
pnpm dev          # Vite + @cloudflare/vite-plugin：真实 Worker 运行时 + 本地 D1
```

首次还需建表：

```bash
wrangler d1 execute main --local --file=drizzle/0000_<...>/migration.sql
```

设置管理口令（同时是 auth 签名 cookie 的 HMAC 密钥）：

```bash
echo "your-token" | wrangler secret put API_TOKEN
```

## 常用命令

```bash
pnpm dev            # 本地开发
pnpm build          # type-check + vite build（并行）
pnpm preview        # build + wrangler dev（跑打包产物）
pnpm type-check     # vue-tsc --build
pnpm lint           # eslint --fix + prettier --write
pnpm test           # vitest（纯逻辑模块）
pnpm deploy         # build + wrangler deploy（生产部署）
pnpm cf-typegen     # 由 wrangler.jsonc 重生成 worker-configuration.d.ts
```

## 数据库 schema 变更

```bash
# 1. 改 server/db/schema.ts + 同步 server/core/<entity>/schema.ts（assert<Equals> 防漂移）
pnpm drizzle-kit generate
# 2. 应用到本地
wrangler d1 execute main --local --file=drizzle/<migration>/migration.sql
# 3. 部署前应用到远端
wrangler d1 execute main --remote --file=drizzle/<migration>/migration.sql
```

时间戳由 DB 侧 `strftime('%Y-%m-%dT%H:%M:%fZ','now')` 生成（唯一给出严格毫秒 ISO 的格式），`updatedAt` 配 `$onUpdate`（仅 `db.update()` 触发，裸 SQL 不触发）。

## 目录结构

```
acme-hub/
├── server/
│   ├── core/
│   │   ├── acme-accounts/   schema + routes + registrar（凭据自动生成 + CA 注册）
│   │   ├── auth/            登录 + 签名 cookie
│   │   ├── certificates/    证书实体
│   │   ├── clients/         客户端实体
│   │   ├── dns-credentials/ DNS API 凭据（cloudflare / alicloud）+ creds.ts 拆分 provider 形态
│   │   └── domains/         待签发域名 + DNS 凭据绑定
│   ├── db/                  drizzle schema + db instance
│   ├── middlewares/         auth gate
│   └── index.ts             Hono app（导出 AppType 供前端 RPC）
├── src/
│   ├── views/<entity>/      列表页 + 详情页 + 编辑器
│   ├── stores/<entity>.ts   pinia（useCachedCollection 一行式）
│   ├── components/
│   │   ├── ui/              本项目的 shadcn 基础组件，可自由增改
│   │   └── acrux-ui/        从 @acrux 注册表安装的源码副本，按上游对待
│   └── utils/api.ts         hc<AppType>("/")
├── drizzle/                 自动生成的迁移 SQL（勿手改）
├── wrangler.jsonc           bindings：DB / kv / ASSETS / API_TOKEN
└── CLAUDE.md                给 AI 编程助手看的项目说明
```

## API 路由

所有 `/api/*`（除 `/api/auth/*`）走签名 cookie 中间件。401 时前端 `rpc()` 自动跳 `/login?next=`。

| 实体                     | 端点                                  |
| ------------------------ | ------------------------------------- |
| `/api/auth/login` `POST` | 登录，user/pass：`root` / `API_TOKEN` |
| `/api/acme-accounts`     | 6-endpoint CRUD；写路径触发自动注册   |
| `/api/clients`           | 标准 CRUD（`createCrudRoutes` 工厂）  |
| `/api/certificates`      | 标准 CRUD                             |
| `/api/dns-credentials`   | 标准 CRUD；删除时级联置空 domains.dnsCredentialId |
| `/api/domains`           | 标准 CRUD                             |

## 部署

```bash
pnpm deploy
```

执行 build + `wrangler deploy`。首次部署前确认：

- `wrangler.jsonc` 的 D1 / KV 占位 id 已替换为真实 id（`wrangler d1 create main` / `wrangler kv namespace create kv`）
- 远端 D1 已应用所有迁移
- `API_TOKEN` secret 已设置

## 关于上层工作区

当前仓库依赖未发布的 `@acrux/*` 包，临时嵌在一个上层 pnpm 工作区里以 `workspace:*` 引用源码。acrux 发布到 npm 后这些会换成正常版本号。日常开发把 acme-hub 当独立应用对待即可。

## License

MIT
