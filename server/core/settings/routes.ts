import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { upsert } from "./schema";
import { getAllSettings, setSettings } from "./service";

export const settingRoutes = new Hono()
  .get("/", async (c) => {
    const settings = await getAllSettings();
    return c.json(settings);
  })
  .put("/", zValidator("json", upsert.body), async (c) => {
    const valid = c.req.valid("json");
    await setSettings(valid);
    const settings = await getAllSettings();
    return c.json(settings);
  });
