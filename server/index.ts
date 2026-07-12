import { Hono } from "hono";
import { env } from "cloudflare:workers";

import { acmeAccountRoutes } from "@server/core/acme-accounts/routes";
import { consumerRoutes } from "@server/core/consumers/routes";
import { certificateRoutes } from "@server/core/certificates/routes";
import { dnsCredentialRoutes } from "@server/core/dns-credentials/routes";
import { domainRoutes } from "@server/core/domains/routes";
import { authRoutes } from "@server/core/auth/routes";
import { pkiRoutes } from "@server/core/pki/routes";
import { settingRoutes } from "@server/core/settings/routes";
import { logRoutes } from "@server/core/logs/routes";
import { requireAuth } from "@server/middlewares/auth";
import { ErrorHandler } from "@acrux/server";
import { scanAndRenew } from "@server/core/pki/cron";

export const app = new Hono()
  .use("/api/*", requireAuth)
  .route("/api/auth", authRoutes)
  .route("/api/acme-accounts", acmeAccountRoutes)
  .route("/api/consumers", consumerRoutes)
  .route("/api/certificates", certificateRoutes)
  .route("/api/dns-credentials", dnsCredentialRoutes)
  .route("/api/domains", domainRoutes)
  .route("/api/settings", settingRoutes)
  .route("/api/logs", logRoutes)
  .route("/pki/v1", pkiRoutes);

export type AppType = typeof app;

app.onError(ErrorHandler);
app.get("/*", () => env.ASSETS.fetch("http://localhost/index.html"));

export default {
  fetch: app.fetch,
  scheduled: async (
    _controller: ScheduledController,
    _env: Env,
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(scanAndRenew());
  },
} satisfies ExportedHandler<Env>;
