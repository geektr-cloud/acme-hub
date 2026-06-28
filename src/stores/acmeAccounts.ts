import { acmeAccount } from "@server/core/acme-accounts";
import { useHonoApi, useCachedCollection } from "@acrux/core";
import { client } from "@/utils/api";
import { defineStore } from "pinia";

export const useAcmeAccountStore = defineStore("acme-accounts", () =>
  useCachedCollection({
    newItem: acmeAccount.newItem,
    maxAge: 30_000,
    fetchFn: useHonoApi(() => client.api["acme-accounts"].$get()),
    removeFn: useHonoApi((id: string) =>
      client.api["acme-accounts"][":id"].$delete({ param: { id } }),
    ),
    upsertFn: useHonoApi((json: acmeAccount.AcmeAccount) =>
      client.api["acme-accounts"].$put({ json }),
    ),
    upsertSchema: acmeAccount.upsert.body,
  }),
);
