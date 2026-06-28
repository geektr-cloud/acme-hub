import { desc } from "drizzle-orm";
import { createCrudRoutes } from "@acrux/server";
import { db, schema } from "@server/db";
import * as domainSchema from "./schema";

export const domainRoutes = createCrudRoutes({
  db,
  table: schema.domains,
  create: domainSchema.create.body,
  upsert: domainSchema.upsert.body,
  notFound: "Domain not found",
  orderBy: (t) => [desc(t.createdAt)],
});
