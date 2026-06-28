import { desc, eq } from "drizzle-orm";
import { HttpErr, createCrudRoutes } from "@acrux/server";
import { db, schema } from "@server/db";
import * as clientSchema from "./schema";

const genToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const clientRoutes = createCrudRoutes({
  db,
  table: schema.clients,
  create: clientSchema.create.body,
  upsert: clientSchema.upsert.body,
  notFound: "Client not found",
  orderBy: (t) => [desc(t.createdAt)],
  beforeCreate: () => ({ token: genToken() }),
}).post("/:id/rotate-token", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.id, id));
  if (!existing) throw HttpErr(404, "Client not found");
  const [row] = await db
    .update(schema.clients)
    .set({ token: genToken() })
    .where(eq(schema.clients.id, id))
    .returning();
  return c.json(row);
});
