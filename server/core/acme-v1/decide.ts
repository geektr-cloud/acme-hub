import { crypto } from "@geektr/acme-dns01";
import { RENEW_RATIO } from "./config";

export type Decision =
  | { mode: "cache"; notAfter: Date }
  | { mode: "renew"; reason: string }
  | { mode: "issue"; reason: string };

export function decideByInfo(
  info: { notBefore: Date; notAfter: Date },
  now: number,
): Decision {
  const notAfter = info.notAfter.getTime();
  const notBefore = info.notBefore.getTime();

  if (notAfter <= now) {
    return { mode: "renew", reason: "证书已过期" };
  }

  const lifetime = notAfter - notBefore;
  if (lifetime <= 0) {
    return { mode: "renew", reason: "证书有效期异常" };
  }

  const elapsed = now - notBefore;
  if (elapsed / lifetime >= RENEW_RATIO) {
    return { mode: "renew", reason: "证书寿命已过半" };
  }

  return { mode: "cache", notAfter: info.notAfter };
}

export function decide(
  existingCer: string | null | undefined,
  now: number = Date.now(),
): Decision {
  if (!existingCer) {
    return { mode: "issue", reason: "无已有证书" };
  }

  try {
    const info = crypto.readCertificateInfo(existingCer);
    return decideByInfo(info, now);
  } catch {
    return { mode: "renew", reason: "证书解析失败" };
  }
}
