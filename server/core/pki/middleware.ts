import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { HttpErr } from "@acrux/server";
import { db, schema } from "@server/db";
import type { Consumer } from "@server/db/schema";

export type PkiEnv = {
  Variables: { consumer: Consumer };
  Bindings: Cloudflare.Env;
};

export const requireConsumer = createMiddleware<PkiEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw HttpErr(401, "unauthorized");
  const token = header.slice(7).trim();
  if (!token) throw HttpErr(401, "unauthorized");

  const [row] = await db
    .select()
    .from(schema.consumers)
    .where(eq(schema.consumers.token, token))
    .limit(1);
  if (!row) throw HttpErr(401, "unauthorized");

  c.set("consumer", row);
  return next();
});
