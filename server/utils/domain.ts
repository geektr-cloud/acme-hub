export function pickPrimaryDomain(domains: string[]): string {
  return domains[0]!.replace(/^\*\./, "");
}
