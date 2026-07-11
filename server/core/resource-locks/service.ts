import { eq, and, inArray, lt } from "drizzle-orm";
import { db, schema } from "@server/db";

export async function acquire(
  ids: string[],
  owner: string,
  remark: string,
  ttlMs = 10 * 60_000,
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const nowStr = now.toISOString();

  await db
    .delete(schema.resourceLocks)
    .where(
      and(
        inArray(schema.resourceLocks.id, ids),
        lt(schema.resourceLocks.expiresAt, nowStr),
      ),
    );

  const existing = await db
    .select({ id: schema.resourceLocks.id, owner: schema.resourceLocks.owner })
    .from(schema.resourceLocks)
    .where(inArray(schema.resourceLocks.id, ids));

  const conflict = existing.find((row) => row.owner !== owner);
  if (conflict) return false;

  for (const id of ids) {
    await db
      .insert(schema.resourceLocks)
      .values({ id, owner, remark, expiresAt })
      .onConflictDoUpdate({
        target: schema.resourceLocks.id,
        set: { expiresAt, remark },
      });
  }

  return true;
}

export async function release(owner: string): Promise<void> {
  await db
    .delete(schema.resourceLocks)
    .where(eq(schema.resourceLocks.owner, owner));
}

export async function releaseIds(ids: string[], owner: string): Promise<void> {
  await db
    .delete(schema.resourceLocks)
    .where(
      and(
        inArray(schema.resourceLocks.id, ids),
        eq(schema.resourceLocks.owner, owner),
      ),
    );
}

export async function renew(owner: string, ttlMs = 10 * 60_000): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db
    .update(schema.resourceLocks)
    .set({ expiresAt })
    .where(eq(schema.resourceLocks.owner, owner));
}
