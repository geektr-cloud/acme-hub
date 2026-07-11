import { Hono } from "hono";
import { env } from "cloudflare:workers";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { HttpErr } from "@acrux/server";
import * as schema from "./schema";
import { getAdminPassword } from "../settings/service";

const COOKIE_NAME = "auth";
const COOKIE_VALUE = "ok";

export const authRoutes = new Hono()
  .post("/login", zValidator("json", schema.login.body), async (c) => {
    const { username, password } = c.req.valid("json");
    const adminPassword = await getAdminPassword();
    if (username !== "root" || password !== adminPassword) {
      throw HttpErr(401, "invalid credentials");
    }
    await setSignedCookie(c, COOKIE_NAME, COOKIE_VALUE, env.API_TOKEN, {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      path: "/",
    });
    return c.json({ ok: true });
  })
  .post("/logout", (c) => {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  })
  .get("/me", async (c) => {
    const val = await getSignedCookie(c, env.API_TOKEN, COOKIE_NAME);
    return c.json({ authenticated: val === COOKIE_VALUE });
  });

export { COOKIE_NAME, COOKIE_VALUE };
