/**
 * PEM parsing utilities — pure logic, no DOM/Vue dependencies.
 */

export type PemEncode = "hex" | "hex16" | "base64";

/**
 * Strip PEM headers/footers and whitespace, returning the raw base64 body.
 * Returns "" if the input contains no valid PEM block.
 */
export function parsePemBody(pem: string): string {
  if (!pem.includes("-----BEGIN ")) return "";
  return pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
}

/**
 * Decode a PEM string into its raw binary bytes.
 * Returns an empty Uint8Array if the input has no valid base64 body.
 */
export function pemToBytes(pem: string): Uint8Array {
  const body = parsePemBody(pem);
  if (!body) return new Uint8Array(0);
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":");

const toHex16 = (buf: ArrayBuffer) => {
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const tail = hex.slice(-16);
  return tail.replace(/(.{4})/g, "$1 ").trim();
};

const toBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/**
 * Compute the SHA-256 fingerprint of a PEM string.
 *
 * @param encode  Output format (default "base64"):
 *   - "hex"     — "xx:xx:xx:..." colon-separated hex
 *   - "hex16"   — last 16 hex chars, space-separated every 4
 *   - "base64"  — standard base64 of the raw hash
 * Returns "" for empty input.
 */
export async function pemFingerprint(pem: string, encode: PemEncode = "base64"): Promise<string> {
  const bytes = pemToBytes(pem);
  if (bytes.length === 0) return "";
  const hash = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  if (encode === "hex") return toHex(hash);
  if (encode === "hex16") return toHex16(hash);
  return toBase64(hash);
}
