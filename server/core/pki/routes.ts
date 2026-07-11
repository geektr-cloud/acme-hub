import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { HttpErr } from "@acrux/server";
import { crypto } from "@geektr/acme-dns01";
import { requireConsumer } from "./middleware";
import type { PkiEnv } from "./middleware";
import * as pkiSchema from "./schema";
import { requestCert, listCerts, matchCert } from "./core";
import { renewAt, cacheControl } from "./decide";
import { getRenewWindowRatio } from "../settings/service";
import { recordLog } from "../logs/service";

export const pkiRoutes = new Hono<PkiEnv>()
  .use("*", requireConsumer)
  .get("/certificates", async (c) => {
    const consumer = c.get("consumer");
    const certs = await listCerts(consumer);
    c.executionCtx.waitUntil(
      recordLog({
        consumerId: consumer.id,
        event: "certificate.list",
        description: `获取证书列表，共 ${certs.length} 个`,
      }),
    );
    return c.json({ certs });
  })
  .get("/certificates/lookup", async (c) => {
    const consumer = c.get("consumer");
    const domains = c.req.queries("domain");
    if (!domains || domains.length === 0) {
      throw HttpErr(400, "at least one domain parameter is required");
    }
    const ratio = await getRenewWindowRatio();
    const match = await matchCert(consumer, domains, ratio);
    if (!match || !match.cert.certificate) {
      throw HttpErr(404, "no matching certificate found");
    }
    const { cert: certRow } = match;
    const info = crypto.readCertificateInfo(certRow.certificate);
    const ra = renewAt(info, ratio);
    c.header("Cache-Control", cacheControl(ra));
    return c.json({
      commonName: certRow.commonName,
      sans: (certRow.sans as string[]) ?? [],
      privateKey: certRow.privateKey,
      certificate: certRow.certificate,
      chain: certRow.chain,
      fullchain: certRow.certificate + "\n" + certRow.chain,
      notBefore: info.notBefore.toISOString(),
      notAfter: info.notAfter.toISOString(),
    });
  })
  .post("/certificates/issue", zValidator("json", pkiSchema.cert.body), (c) => {
    const consumer = c.get("consumer");
    const { domains } = c.req.valid("json");
    c.executionCtx.waitUntil(
      recordLog({
        consumerId: consumer.id,
        event: "certificate.issue",
        description: `获取证书，SAN: ${domains.join(", ")}`,
      }),
    );
    const accept = c.req.header("Accept") ?? "";
    if (accept.includes("text/event-stream")) {
      return streamSSE(c, async (stream) => {
        const heartbeat = setInterval(
          () => void stream.writeSSE({ event: "ping", data: "" }),
          15_000,
        );
        try {
          await requestCert(consumer, domains, c.executionCtx, (e) =>
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
            data: JSON.stringify({ type: "failed", status, message }),
          });
        } finally {
          clearInterval(heartbeat);
        }
      });
    }
    return (async () => {
      const { result, cacheControl: cc } = await requestCert(
        consumer,
        domains,
        c.executionCtx,
      );
      c.header("Cache-Control", cc);
      return c.json(result);
    })();
  });
