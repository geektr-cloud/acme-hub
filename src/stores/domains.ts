import { domain } from "@server/core/domains";
import { useHonoApi, useCachedCollection } from "@acrux/core";
import { client } from "@/utils/api";
import { defineStore } from "pinia";

export const useDomainStore = defineStore("domains", () =>
  useCachedCollection({
    newItem: domain.newItem,
    maxAge: 30_000,
    fetchFn: useHonoApi(() => client.api.domains.$get()),
    removeFn: useHonoApi((id: string) =>
      client.api.domains[":id"].$delete({ param: { id } }),
    ),
    upsertFn: useHonoApi((json: domain.Domain) =>
      client.api.domains.$put({ json }),
    ),
    upsertSchema: domain.upsert.body,
  }),
);
