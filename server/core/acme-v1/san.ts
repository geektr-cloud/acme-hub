export function needNewKeypair(
  requestedDomains: string[],
  existingAlt: string[],
): boolean {
  if (existingAlt.length === 0) return true;
  return !requestedDomains.every((d) => existingAlt.includes(d));
}
