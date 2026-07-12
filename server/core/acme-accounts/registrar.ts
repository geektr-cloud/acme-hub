import { Client, crypto } from "@geektr/acme-dns01";
import { HttpErr } from "@acrux/server";
import { acmeProxyFor } from "@server/utils/acme-proxy";
import type { Creds } from "./schema";

// 注册请求的最小输入：与 schema.create.body 兼容的子集（其余字段路由层处理）。
export interface RegistrationInput {
  email: string;
  acmeUrl: string;
  creds: Creds | null;
}

// 判定凭据是否「已完整注册」——有账户 URL 且有私钥即视为已注册，不再触 CA。
const isRegistered = (creds: Creds | null): boolean =>
  Boolean(creds?.accountUrl && creds.privateKey);

// 库返回 Uint8Array（PEM 字节流），用 utf-8 解出文本以入库存储。
const decoder = new TextDecoder();
const pemToString = (pem: Uint8Array | string): string =>
  typeof pem === "string" ? pem : decoder.decode(pem);

/**
 * 若 creds 已含账户 URL + 私钥，原样返回；否则按需生成 ECDSA P-256 密钥对并向 CA 注册账户，
 * 返回完整 creds（privateKey/publicKey/accountUrl + 透传 eab）。
 *
 * EAB（ZeroSSL 等）：若 creds.eab 含 kid + hmacKey，注册时附带 externalAccountBinding。
 */
export const ensureRegistered = async (
  input: RegistrationInput,
): Promise<Creds> => {
  const { email, acmeUrl } = input;
  const existing = input.creds;

  if (isRegistered(existing)) return existing as Creds;

  // 复用已有私钥（用户手动粘贴）或现场生成 ECDSA P-256。
  const privateKey =
    existing?.privateKey ??
    pemToString(await crypto.createPrivateEcdsaKey("P-256"));
  const publicKey =
    existing?.publicKey ?? pemToString(await crypto.getPublicKey(privateKey));

  const eab = existing?.eab ?? null;
  const hasEab = Boolean(eab?.kid && eab.hmacKey);

  const client = new Client({
    directoryUrl: acmeUrl,
    accountKey: privateKey,
    acmeProxy: acmeProxyFor(acmeUrl),
    ...(hasEab && eab
      ? { externalAccountBinding: { kid: eab.kid, hmacKey: eab.hmacKey } }
      : {}),
  });

  try {
    await client.createAccount({
      termsOfServiceAgreed: true,
      ...(email ? { contact: [`mailto:${email}`] } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw HttpErr(502, `ACME 账户注册失败：${msg}`);
  }

  const accountUrl = client.getAccountUrl();

  return {
    privateKey,
    publicKey,
    accountUrl,
    ...(hasEab && eab ? { eab } : {}),
  };
};
