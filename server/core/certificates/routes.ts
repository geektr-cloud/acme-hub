import { desc } from "drizzle-orm";
import { db, schema } from "@server/db";
import { createCrudRoutes } from "@acrux/server";
import * as certificateSchema from "./schema";

export const certificateRoutes = createCrudRoutes({
  db,
  table: schema.certificates,
  create: certificateSchema.create.body,
  upsert: certificateSchema.upsert.body,
  notFound: "Certificate not found",
  orderBy: (t) => [desc(t.createdAt)],
});
