import type { AllowRule } from "@server/core/clients/schema";
export type { AllowRule };

/**
 * Check if domain matches any allow rule.
 * fulltext: exact match. suffix: label-aligned endsWith (domain === pattern || domain.endsWith("." + pattern)).
 * Empty rules → deny. Pattern中的 * 当普通字符。
 */
export function allowMatch(domain: string, rules: AllowRule[]): boolean {
  if (rules.length === 0) return false;
  for (const rule of rules) {
    if (rule.type === "fulltext") {
      if (domain === rule.pattern) return true;
    } else if (rule.type === "suffix") {
      if (domain === rule.pattern || domain.endsWith("." + rule.pattern))
        return true;
    }
  }
  return false;
}
