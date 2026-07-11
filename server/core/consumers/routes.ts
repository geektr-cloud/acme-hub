import { desc, eq } from "drizzle-orm";
import { HttpErr, createCrudRoutes } from "@acrux/server";
import { db, schema } from "@server/db";
import * as consumerSchema from "./schema";

const genToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const consumerRoutes = createCrudRoutes({
  db,
  table: schema.consumers,
  create: consumerSchema.create.body,
  upsert: consumerSchema.upsert.body,
  notFound: "Consumer not found",
  orderBy: (t) => [desc(t.createdAt)],
  beforeCreate: () => ({ token: genToken() }),
}).post("/:id/rotate-token", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(schema.consumers)
    .where(eq(schema.consumers.id, id));
  if (!existing) throw HttpErr(404, "Consumer not found");
  const [row] = await db
    .update(schema.consumers)
    .set({ token: genToken() })
    .where(eq(schema.consumers.id, id))
    .returning();
  return c.json(row);
});
