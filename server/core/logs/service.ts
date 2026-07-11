import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@server/db";
import type { LogItem } from "./schema";

export async function recordLog(input: {
  consumerId: string;
  event: string;
  description: string;
}): Promise<void> {
  await db.insert(schema.consumerLogs).values({
    consumerId: input.consumerId,
    event: input.event,
    description: input.description,
  });
}

export async function listLogs({
  page,
  limit,
}: {
  page: number;
  limit: number;
}): Promise<{ items: LogItem[]; total: number }> {
  const offset = (page - 1) * limit;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.consumerLogs);
  const total = countRow?.count ?? 0;

  const rows = await db
    .select({
      id: schema.consumerLogs.id,
      consumerId: schema.consumerLogs.consumerId,
      consumerName: schema.consumers.name,
      event: schema.consumerLogs.event,
      description: schema.consumerLogs.description,
      createdAt: schema.consumerLogs.createdAt,
    })
    .from(schema.consumerLogs)
    .leftJoin(
      schema.consumers,
      eq(schema.consumerLogs.consumerId, schema.consumers.id),
    )
    .orderBy(desc(schema.consumerLogs.id))
    .limit(limit)
    .offset(offset);

  const items: LogItem[] = rows.map((r) => ({
    id: r.id,
    consumerId: r.consumerId,
    consumerName: r.consumerName ?? null,
    event: r.event,
    description: r.description,
    createdAt: r.createdAt,
  }));

  return { items, total };
}
