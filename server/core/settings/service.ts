import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { db, schema } from "@server/db";
import type { Settings } from "./schema";
import { KEYS } from "./schema";
import { DEFAULT_RENEW_RATIO } from "../pki/config";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function getAllSettings(): Promise<Settings> {
  const rows = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings);

  const map = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(KEYS.map((k) => [k, map.get(k) ?? ""])) as Settings;
}

export async function setSettings(partial: Partial<Settings>): Promise<void> {
  const entries = Object.entries(partial).filter(
    (entry): entry is [string, string] =>
      KEYS.includes(entry[0] as (typeof KEYS)[number]),
  );
  for (const [key, value] of entries) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({
      target: schema.settings.key,
      set: { value },
    });
  }
}

export async function getRenewWindowRatio(): Promise<number> {
  const raw = await getSetting("renew_window_ratio");
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n < 1) return n;
  }
  return DEFAULT_RENEW_RATIO;
}

export async function getAdminPassword(): Promise<string> {
  const raw = await getSetting("admin_password");
  if (raw) return raw;
  return env.API_TOKEN;
}
