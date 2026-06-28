import { client as clientSchema } from "@server/core/clients";
import { useHonoApi, useCachedCollection } from "@acrux/core";
import { client } from "@/utils/api";
import { defineStore } from "pinia";

export const useClientStore = defineStore("clients", () =>
  useCachedCollection({
    newItem: clientSchema.newItem,
    maxAge: 30_000,
    fetchFn: useHonoApi(() => client.api.clients.$get()),
    removeFn: useHonoApi((id: string) =>
      client.api.clients[":id"].$delete({ param: { id } }),
    ),
    upsertFn: useHonoApi((json: clientSchema.Client) =>
      client.api.clients.$put({ json }),
    ),
    upsertSchema: clientSchema.upsert.body,
  }),
);
