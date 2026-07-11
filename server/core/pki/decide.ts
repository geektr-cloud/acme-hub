import { crypto } from "@geektr/acme-dns01";
import { DEFAULT_RENEW_RATIO } from "./config";

export type Decision =
  | { mode: "cache"; notAfter: Date; renewAt: Date }
  | { mode: "renew"; reason: string }
  | { mode: "issue"; reason: string };

export function renewAt(
  info: { notBefore: Date; notAfter: Date },
  ratio = DEFAULT_RENEW_RATIO,
): Date {
  const lifetime = info.notAfter.getTime() - info.notBefore.getTime();
  return new Date(info.notBefore.getTime() + lifetime * ratio);
}

export function cacheControl(renewAt: Date, now = Date.now()): string {
  const maxAge = Math.max(
    0,
    Math.floor((renewAt.getTime() - 86_400_000 - now) / 1000),
  );
  return maxAge === 0 ? "max-age=0, must-revalidate" : `max-age=${maxAge}`;
}

export function decideByInfo(
  info: { notBefore: Date; notAfter: Date },
  now: number,
  ratio = DEFAULT_RENEW_RATIO,
): Decision {
  const notAfter = info.notAfter.getTime();
  const notBefore = info.notBefore.getTime();

  if (notAfter <= now) {
    return { mode: "renew", reason: "certificate expired" };
  }

  const lifetime = notAfter - notBefore;
  if (lifetime <= 0) {
    return { mode: "renew", reason: "certificate validity period abnormal" };
  }

  const elapsed = now - notBefore;
  if (elapsed / lifetime >= ratio) {
    return { mode: "renew", reason: "certificate past renewal threshold" };
  }

  return {
    mode: "cache",
    notAfter: info.notAfter,
    renewAt: renewAt(info, ratio),
  };
}

export function decide(
  existingCer: string | null | undefined,
  now: number = Date.now(),
  ratio = DEFAULT_RENEW_RATIO,
): Decision {
  if (!existingCer) {
    return { mode: "issue", reason: "no existing certificate" };
  }

  try {
    const info = crypto.readCertificateInfo(existingCer);
    return decideByInfo(info, now, ratio);
  } catch {
    return { mode: "renew", reason: "certificate parse failed" };
  }
}
