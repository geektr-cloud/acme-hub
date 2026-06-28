import { desc } from "drizzle-orm";
import { db, schema } from "@server/db";
import { createCrudRoutes } from "@acrux/server";
import * as clientSchema from "./schema";

export const clientRoutes = createCrudRoutes({
  db,
  table: schema.clients,
  create: clientSchema.create.body,
  upsert: clientSchema.upsert.body,
  notFound: "Client not found",
  orderBy: (t) => [desc(t.createdAt)],
});
