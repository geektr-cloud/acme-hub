import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { requireClient } from "./middleware";
import type { AcmeV1Env } from "./middleware";
import * as v1Schema from "./schema";
import { requestCert, listCerts } from "./core";

export const acmeV1Routes = new Hono<AcmeV1Env>()
  .use("*", requireClient)
  .get("/certs", async (c) => {
    const client = c.get("client");
    const certs = await listCerts(client);
    return c.json({ certs });
  })
  .post("/cert", zValidator("json", v1Schema.cert.body), async (c) => {
    const client = c.get("client");
    const { domains } = c.req.valid("json");
    const result = await requestCert(client, domains);
    return c.json(result);
  })
  .post("/cert/sse", zValidator("json", v1Schema.cert.body), (c) => {
    const client = c.get("client");
    const { domains } = c.req.valid("json");
    return streamSSE(c, async (stream) => {
      const heartbeat = setInterval(
        () => void stream.writeSSE({ event: "ping", data: "" }),
        15_000,
      );
      try {
        await requestCert(client, domains, (e) =>
          stream.writeSSE({ event: "cert", data: JSON.stringify(e) }),
        );
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err !== null && "status" in err
            ? Number((err as { status: unknown }).status) || 500
            : 500;
        const message = err instanceof Error ? err.message : "unknown error";
        await stream.writeSSE({
          event: "cert",
          data: JSON.stringify({ type: "error", status, message }),
        });
      } finally {
        clearInterval(heartbeat);
      }
    });
  });
