export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function certHashOf(
  acmeAccountId: string,
  sans: string[],
): Promise<string> {
  return sha256Hex(acmeAccountId + "|" + [...sans].sort().join(","));
}

export function lockIdOf(fullDomain: string): Promise<string> {
  return sha256Hex(fullDomain);
}
