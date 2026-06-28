import { desc, eq } from "drizzle-orm";
import { createCrudRoutes } from "@acrux/server";
import { db, schema } from "@server/db";
import * as dnsCredentialSchema from "./schema";

export const dnsCredentialRoutes = createCrudRoutes({
  db,
  table: schema.dnsCredentials,
  create: dnsCredentialSchema.create.body,
  upsert: dnsCredentialSchema.upsert.body,
  notFound: "DNS credential not found",
  orderBy: (t) => [desc(t.createdAt)],
  beforeDelete: async (id) => {
    await db
      .update(schema.domains)
      .set({ dnsCredentialId: null })
      .where(eq(schema.domains.dnsCredentialId, id));
  },
});
