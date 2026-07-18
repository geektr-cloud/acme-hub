# caddy-acme-hub

Caddy `tls.get_certificate` 插件，从 [acme-hub](https://acme.geektr.cloud) 拉取证书。跳过 CertMagic 的 ACME 流程，由 acme-hub 主导签发/续期/缓存决策。

## 安装

### Docker 镜像（推荐）

```bash
docker pull ghcr.io/geektr-cloud/acme-hub/caddy:latest
# 或指定版本
docker pull ghcr.io/geektr-cloud/acme-hub/caddy:v0.1.0
```

多架构支持：`linux/amd64`, `linux/arm64`

### xcaddy 构建

从 GitHub 安装：

```bash
xcaddy build --with github.com/geektr-cloud/acme-hub/integrations/caddy
```

本地开发（在 acme-hub 仓库根目录执行）：

```bash
xcaddy build --with github.com/geektr-cloud/acme-hub/integrations/caddy=./integrations/caddy
```

## Caddyfile 配置

基本用法（推荐）：

```caddyfile
{
	tls {
		get_certificate acmehub
		renewal_window_ratio 0.01
	}
}
```

使用 named profile：

```caddyfile
{
	tls {
		get_certificate acmehub @prod
		renewal_window_ratio 0.01
	}
}
```

内联 endpoint/token（优先级最高）：

```caddyfile
{
	tls {
		get_certificate acmehub {
			endpoint https://acme.geektr.cloud
			token <bearer-token>
		}
		renewal_window_ratio 0.01
	}
}
```

可与 profile 并用（内联值优先于 env/yaml）：

```caddyfile
{
	tls {
		get_certificate acmehub @prod {
			endpoint https://acme.geektr.cloud
			token <bearer-token>
		}
		renewal_window_ratio 0.01
	}
}
```

## JSON 配置

```json
{
  "apps": {
    "tls": {
      "automation": {
        "policies": [{
          "renewal_window_ratio": 0.01,
          "get_certificate": [{
            "via": "acmehub",
            "profile": "default"
          }]
        }]
      }
    }
  }
}
```

内联 endpoint/token：

```json
{
  "apps": {
    "tls": {
      "automation": {
        "policies": [{
          "renewal_window_ratio": 0.01,
          "get_certificate": [{
            "via": "acmehub",
            "endpoint": "https://acme.geektr.cloud",
            "token": "your-api-token"
          }]
        }]
      }
    }
  }
}
```

## 配置来源（优先级从高到低）

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | Caddyfile 内联块 | `get_certificate acmehub { endpoint ...; token ... }` |
| 2 | env（无标识） | `CADDY_ACMEHUB_ENDPOINT` / `CADDY_ACMEHUB_TOKEN`（仅 default） |
| 3 | env（有标识） | `CADDY_ACMEHUB_DEFAULT_ENDPOINT` / `CADDY_ACMEHUB_DEFAULT_TOKEN`（仅 default） |
| 4 | yaml 顶层裸字段 | `endpoint` / `token`（仅 default） |
| 5 | yaml profile 段 | `default.endpoint` / `default.token` 或 `<profile>.endpoint` / `<profile>.token` |

内联块要求 `endpoint` 和 `token` 同时提供，否则 `Provision` 报错。

## acmehub.yaml

路径：`<Caddy AppDataDir>/acmehub.yaml`

单 profile：

```yaml
endpoint: https://acme.geektr.cloud
token: your-api-token
```

多 profile：

```yaml
default:
  endpoint: https://acme.geektr.cloud
  token: token-default
prod:
  endpoint: https://acme.geektr.cloud
  token: token-prod
staging:
  endpoint: https://acme-staging.geektr.cloud
  token: token-staging
```

## acme-hub 侧配置

在 acme-hub 的 `clients` 表创建一个 client，`token` 填 Caddy 侧使用的值，`allow` 填对应域名规则（`fulltext` 或 `suffix`）。

## 缓存与续签

**设计原则**：插件只听 acme-hub 的 `Cache-Control` 响应头，不做自适应缓存。续签完全由 acme-hub 管理。

### 为什么推荐 `renewal_window_ratio 0.01`

Caddy 默认的 `renewal_window_ratio` 是 `0.3333`（证书剩余 33% 寿命时触发续期）。但这会与 acme-hub 的续签逻辑冲突：

- acme-hub 通过 `Cache-Control: max-age=N` 控制插件缓存时间
- Caddy 的 certmagic 在证书剩余 33% 时驱逐缓存，强制调插件重新拉取
- 如果 acme-hub 的 `Cache-Control` 设置的缓存时间比 certmagic 驱逐时间长，certmagic 会提前驱逐，导致不必要的 API 调用

设置 `renewal_window_ratio 0.01` 后：
- certmagic 仅在证书剩余 1% 寿命时才驱逐（90 天证书 → 剩余不到 1 天）
- acme-hub 通过 `Cache-Control` 完全控制缓存时间
- 插件只在缓存过期时调 API，certmagic 基本不干预

### 缓存流程

```
1. 插件请求证书 → acme-hub 返回证书 + Cache-Control: max-age=N
2. 插件缓存 N 秒
3. 缓存过期 → 下次 TLS 握手调 API
4. acme-hub 决定返回缓存证书或续签后的新证书
5. 重复
```

`max-age=0` 或无 `Cache-Control` 时不缓存，每次都调 API。

## 模块 ID

`tls.get_certificate.acmehub`
