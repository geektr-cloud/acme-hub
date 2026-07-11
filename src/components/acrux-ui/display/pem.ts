/**
 * PEM parsing utilities — pure logic, no DOM/Vue dependencies.
 */

export type PemEncode = "hex" | "hex16" | "base64";

export interface PemBlock {
  label: string;
  raw: string;
}

/**
 * Split a (possibly multi-block) PEM string into individual blocks.
 * Each block retains its full PEM text including headers/footers.
 */
export function parsePemBlocks(pem: string): PemBlock[] {
  if (!pem?.includes("-----BEGIN ")) return [];
  const re = /(-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----)/g;
  const blocks: PemBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(pem)) !== null) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    const label = raw.match(/-----BEGIN ([^-]+)-----/)?.[1] ?? "";
    blocks.push({ label, raw });
  }
  return blocks;
}

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

const toBase64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

/**
 * Compute the SHA-256 fingerprint of a single PEM string.
 *
 * @param encode  Output format (default "base64"):
 *   - "hex"     — "xx:xx:xx:..." colon-separated hex
 *   - "hex16"   — last 16 hex chars, space-separated every 4
 *   - "base64"  — standard base64 of the raw hash
 * Returns "" for empty input.
 */
export async function pemFingerprint(
  pem: string,
  encode: PemEncode = "base64",
): Promise<string> {
  const bytes = pemToBytes(pem);
  if (bytes.length === 0) return "";
  const hash = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer as ArrayBuffer,
  );
  if (encode === "hex") return toHex(hash);
  if (encode === "hex16") return toHex16(hash);
  return toBase64(hash);
}

/**
 * Compute SHA-256 fingerprints for each PEM block in a (possibly multi-block) string.
 * Returns one entry per block: { label, fingerprint }.
 */
export async function pemFingerprints(
  pem: string,
  encode: PemEncode = "base64",
): Promise<{ label: string; fingerprint: string }[]> {
  const blocks = parsePemBlocks(pem);
  return Promise.all(
    blocks.map(async (b) => ({
      label: b.label,
      fingerprint: await pemFingerprint(b.raw, encode),
    })),
  );
}
