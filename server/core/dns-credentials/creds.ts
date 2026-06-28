import { z } from "zod";

export const provider = z.enum(["cloudflare", "alicloud"]);
export type Provider = z.infer<typeof provider>;

export const cloudflareCreds = z.object({ apiToken: z.string() });
export const alicloudCreds = z.object({
  accessKeyId: z.string(),
  accessKeySecret: z.string(),
});
export type CloudflareCreds = z.infer<typeof cloudflareCreds>;
export type AlicloudCreds = z.infer<typeof alicloudCreds>;

export const credsSchema = z.union([cloudflareCreds, alicloudCreds]).nullable();
export type Creds = z.infer<typeof credsSchema>;

export const refineCreds = (
  v: { provider: Provider; creds: Creds },
  ctx: z.RefinementCtx,
) => {
  if (!v.creds) return;
  const hasApiToken = "apiToken" in v.creds;
  const hasAlicloud = "accessKeyId" in v.creds && "accessKeySecret" in v.creds;
  if (v.provider === "cloudflare" && !hasApiToken) {
    ctx.addIssue({
      code: "custom",
      path: ["creds"],
      message: "Cloudflare 凭据须含 apiToken",
    });
  }
  if (v.provider === "alicloud" && !hasAlicloud) {
    ctx.addIssue({
      code: "custom",
      path: ["creds"],
      message: "阿里云凭据须含 accessKeyId 和 accessKeySecret",
    });
  }
};
