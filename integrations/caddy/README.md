# caddy-acme-hub

Caddy `tls.get_certificate` 插件，从 [acme-hub](https://acme.geektr.cloud) 拉取证书。跳过 CertMagic 的 ACME 流程，由 acme-hub 主导签发/续期/缓存决策。

## 安装

```bash
xcaddy build --with github.com/geektr-cloud/caddy-acme-hub
```

本地开发：

```bash
xcaddy build --with github.com/geektr-cloud/caddy-acme-hub=./integrations/caddy
```

## Caddyfile 配置

基本用法：

```caddyfile
{
	tls {
		get_certificate acmehub
	}
}
```

使用 named profile：

```caddyfile
{
	tls {
		get_certificate acmehub @prod
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

## 缓存

- 从 acme-hub 响应的 `Cache-Control: max-age=N` 解析过期时间
- `max-age=0` 或无 `Cache-Control` 不缓存
- 过期后下次 TLS 握手重新拉取
- 同一 acme-hub 实例的多个 `get_certificate acmehub` 指令共享缓存

## 模块 ID

`tls.get_certificate.acmehub`
