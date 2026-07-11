import { z } from "zod";

export const KEYS = ["renew_window_ratio", "admin_password"] as const;

export const settings = z.object({
  renew_window_ratio: z.string(),
  admin_password: z.string(),
});

export type Settings = z.infer<typeof settings>;

export const upsert = { body: settings.partial() };
