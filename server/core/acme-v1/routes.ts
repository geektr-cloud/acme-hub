import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { HttpErr } from "@acrux/server";
import { crypto } from "@geektr/acme-dns01";
import { requireClient } from "./middleware";
import type { AcmeV1Env } from "./middleware";
import * as v1Schema from "./schema";
import { requestCert, listCerts, matchCert } from "./core";
import { renewAt, cacheControl } from "./decide";

export const acmeV1Routes = new Hono<AcmeV1Env>()
  .use("*", requireClient)
  .get("/certs", async (c) => {
    const client = c.get("client");
    const certs = await listCerts(client);
    return c.json({ certs });
  })
  .get("/certs/match", async (c) => {
    const client = c.get("client");
    const domains = c.req.queries("domain");
    if (!domains || domains.length === 0) {
      throw HttpErr(400, "至少需要一个 domain 参数");
    }
    const match = await matchCert(client, domains);
    if (!match || !match.cert.cer) {
      throw HttpErr(404, "未找到匹配的证书");
    }
    const { cert: certRow } = match;
    const info = crypto.readCertificateInfo(certRow.cer);
    const ra = renewAt(info);
    c.header("Cache-Control", cacheControl(ra));
    return c.json({
      domain: certRow.domain,
      key: certRow.key,
      cer: certRow.cer,
      ca: certRow.ca,
      notAfter: info.notAfter.toISOString(),
    });
  })
  .post("/cert", zValidator("json", v1Schema.cert.body), async (c) => {
    const client = c.get("client");
    const { domains } = c.req.valid("json");
    const { result, cacheControl: cc } = await requestCert(
      client,
      domains,
      c.executionCtx,
    );
    c.header("Cache-Control", cc);
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
        await requestCert(client, domains, c.executionCtx, (e) =>
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
