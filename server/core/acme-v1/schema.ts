import { z } from "zod";

const domain = z
  .string()
  .min(1, "domain 不能为空")
  .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "域名格式不正确");

export const cert = {
  body: z.object({ domain }),
  response: z.object({
    domain: z.string(),
    key: z.string(),
    cer: z.string(),
    ca: z.string(),
    notAfter: z.string(),
  }),
};
