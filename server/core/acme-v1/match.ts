import type { AllowRule } from "@server/core/clients/schema";
export type { AllowRule };

function wildcardToBare(domain: string): string {
  return domain.startsWith("*.") ? domain.slice(2) : domain;
}

export function findAllowMatch(
  domain: string,
  rules: AllowRule[],
): AllowRule | null {
  const bare = wildcardToBare(domain);
  for (const rule of rules) {
    if (rule.type === "fulltext") {
      if (domain === rule.pattern) return rule;
    } else if (rule.type === "suffix") {
      if (bare === rule.pattern || bare.endsWith("." + rule.pattern))
        return rule;
    }
  }
  return null;
}

export function allowMatch(domain: string, rules: AllowRule[]): boolean {
  return findAllowMatch(domain, rules) !== null;
}
