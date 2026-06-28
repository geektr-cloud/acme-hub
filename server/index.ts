import { Hono } from "hono";
import { env } from "cloudflare:workers";

import { acmeAccountRoutes } from "@server/core/acme-accounts/routes";
import { clientRoutes } from "@server/core/clients/routes";
import { certificateRoutes } from "@server/core/certificates/routes";
import { dnsCredentialRoutes } from "@server/core/dns-credentials/routes";
import { domainRoutes } from "@server/core/domains/routes";
import { authRoutes } from "@server/core/auth/routes";
import { requireAuth } from "@server/middlewares/auth";
import { ErrorHandler } from "@acrux/server";

export const app = new Hono()
  .use("/api/*", requireAuth)
  .route("/api/auth", authRoutes)
  .route("/api/acme-accounts", acmeAccountRoutes)
  .route("/api/clients", clientRoutes)
  .route("/api/certificates", certificateRoutes)
  .route("/api/dns-credentials", dnsCredentialRoutes)
  .route("/api/domains", domainRoutes);

export type AppType = typeof app;

app.onError(ErrorHandler);
app.get("/*", () => env.ASSETS.fetch("http://localhost/index.html"));

export default app;
