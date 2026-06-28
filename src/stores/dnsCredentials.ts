import { dnsCredential } from "@server/core/dns-credentials";
import { useHonoApi, useCachedCollection } from "@acrux/core";
import { client } from "@/utils/api";
import { defineStore } from "pinia";

export const useDnsCredentialStore = defineStore("dnsCredentials", () =>
  useCachedCollection({
    newItem: dnsCredential.newItem,
    maxAge: 30_000,
    fetchFn: useHonoApi(() => client.api["dns-credentials"].$get()),
    removeFn: useHonoApi((id: string) =>
      client.api["dns-credentials"][":id"].$delete({ param: { id } }),
    ),
    upsertFn: useHonoApi((json: dnsCredential.DnsCredential) =>
      client.api["dns-credentials"].$put({ json }),
    ),
    upsertSchema: dnsCredential.upsert.body,
  }),
);
