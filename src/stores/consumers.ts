import { consumer as consumerSchema } from "@server/core/consumers";
import { useHonoApi, useCachedCollection } from "@acrux/core";
import { client } from "@/utils/api";
import { defineStore } from "pinia";

export const useConsumerStore = defineStore("consumers", () =>
  useCachedCollection({
    newItem: consumerSchema.newItem,
    maxAge: 30_000,
    fetchFn: useHonoApi(() => client.api.consumers.$get()),
    removeFn: useHonoApi((id: string) =>
      client.api.consumers[":id"].$delete({ param: { id } }),
    ),
    upsertFn: useHonoApi((json: consumerSchema.Consumer) =>
      client.api.consumers.$put({ json }),
    ),
    upsertSchema: consumerSchema.upsert.body,
  }),
);
