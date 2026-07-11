import { asc, and, gt, eq } from "drizzle-orm";
import { db, schema } from "@server/db";

export async function appendEvent(
  runId: string,
  certHash: string,
  event: { type: string; message?: string; [key: string]: unknown },
): Promise<void> {
  await db.insert(schema.certEvents).values({ runId, certHash, event });
}

export async function tailEvents(
  runId: string,
  afterId: string | null,
): Promise<(typeof schema.certEvents.$inferSelect)[]> {
  const conditions = [eq(schema.certEvents.runId, runId)];
  if (afterId) {
    conditions.push(gt(schema.certEvents.id, afterId));
  }
  return db
    .select()
    .from(schema.certEvents)
    .where(and(...conditions))
    .orderBy(asc(schema.certEvents.id));
}
