import { createMiddleware } from "hono/factory";
import { env } from "cloudflare:workers";
import { getSignedCookie } from "hono/cookie";
import { HttpErr } from "@acrux/server";

const COOKIE_NAME = "auth";
const COOKIE_VALUE = "ok";

export const requireAuth = createMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/api/auth/")) return next();
  const val = await getSignedCookie(c, env.API_TOKEN, COOKIE_NAME);
  if (val !== COOKIE_VALUE) throw HttpErr(401, "unauthorized");
  return next();
});
