import { z } from "zod";

export const logItem = z.object({
  id: z.string(),
  consumerId: z.string(),
  consumerName: z.string().nullable(),
  event: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

export type LogItem = z.infer<typeof logItem>;
