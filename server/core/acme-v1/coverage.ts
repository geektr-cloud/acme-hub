import { HttpErr } from "@acrux/server";

export function isWildcard(d: string): boolean {
  return d.startsWith("*.");
}

export function assertValidDomainName(d: string): void {
  if (d.includes("*")) {
    if (!d.startsWith("*.") || d.indexOf("*", 1) !== -1) {
      throw HttpErr(400, `非法通配域名: ${d}`);
    }
    const rest = d.slice(2);
    if (!rest || rest.includes("*")) {
      throw HttpErr(400, `非法通配域名: ${d}`);
    }
  }
}

export function coversDomain(san: string[], requested: string): boolean {
  if (isWildcard(requested)) {
    return san.includes(requested);
  }
  for (const s of san) {
    if (s === requested) return true;
    if (isWildcard(s)) {
      const parent = s.slice(2);
      const dotParent = "." + parent;
      if (
        requested.endsWith(dotParent) &&
        requested.length > dotParent.length
      ) {
        const prefix = requested.slice(0, requested.length - dotParent.length);
        if (!prefix.includes(".")) return true;
      }
    }
  }
  return false;
}

export function certCoversAll(san: string[], requested: string[]): boolean {
  return requested.every((d) => coversDomain(san, d));
}

export function scoreCert(san: string[], requested: string[]): number {
  let score = 0;
  for (const s of san) {
    if (isWildcard(s)) {
      const parent = s.slice(2);
      const covers = requested.some((req) => {
        if (req === s) return true;
        const dotParent = "." + parent;
        return (
          req.endsWith(dotParent) &&
          req.length > dotParent.length &&
          !req.slice(0, req.length - dotParent.length).includes(".")
        );
      });
      if (covers) score += 1000;
    } else {
      if (requested.includes(s)) {
        score += 100;
      } else {
        score += 1;
      }
    }
  }
  return score;
}

export function pickBestCert<
  T extends { alt: string[]; domain: string; createdAt: string },
>(certs: T[], requested: string[]): T | null {
  const eligible = certs.filter((c) => certCoversAll(c.alt, requested));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const sa = scoreCert(a.alt, requested);
    const sb = scoreCert(b.alt, requested);
    if (sa !== sb) return sb - sa;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return eligible[0] ?? null;
}
