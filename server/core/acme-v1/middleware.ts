import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { HttpErr } from "@acrux/server";
import { db, schema } from "@server/db";
import type { Client } from "@server/db/schema";

export type AcmeV1Env = { Variables: { client: Client } };

export const requireClient = createMiddleware<AcmeV1Env>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw HttpErr(401, "unauthorized");
  const token = header.slice(7).trim();
  if (!token) throw HttpErr(401, "unauthorized");

  const [row] = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.token, token))
    .limit(1);
  if (!row) throw HttpErr(401, "unauthorized");

  c.set("client", row);
  return next();
});
