import { env } from "cloudflare:workers";

const DEFAULT_ENDPOINT = "https://cloudflare-pal.geektr.cloud";

/**
 * 由 ACME directory URL 推导 acme-dns01 的 `acmeProxy` 传输层代理前缀。
 *
 * 背景：Cloudflare Worker 出站 fetch 打 Let's Encrypt（自身也托管在 CF 后面）
 * 触发 orange-to-orange，稳定返回 525。cloudflare-pal 作为路径式代理转发到 LE 绕开 O2O。
 *
 * 形如 `https://cloudflare-pal.geektr.cloud/acme-v02.api.letsencrypt.org`——
 * acme-dns01 把每个请求物理改写到 `acmeProxy + pathname + search`，
 * JWS 签名的 url/kid 仍用真实 LE 地址不变（RFC 8555 §6.4 绑定不破坏）。
 *
 * CFPAL_ENDPOINT 为空串时回退默认端点（用 `||`，空串不是 nullish）。
 */
export function acmeProxyFor(acmeUrl: string): string {
  const endpoint = env.CFPAL_ENDPOINT || DEFAULT_ENDPOINT;
  const host = new URL(acmeUrl).host;
  return `${endpoint.replace(/\/+$/, "")}/${host}`;
}
