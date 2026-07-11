import { Hono } from "hono";
import { z } from "zod";
import { clampLimit } from "@acrux/server";
import { listLogs } from "./service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: clampLimit(20, 100),
});

export const logRoutes = new Hono().get("/", async (c) => {
  const query = querySchema.parse(c.req.query());
  const result = await listLogs(query);
  return c.json(result);
});
