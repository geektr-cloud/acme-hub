import { certificate } from "@server/core/certificates";
import { useHonoApi, useCachedCollection } from "@acrux/core";
import { client } from "@/utils/api";
import { defineStore } from "pinia";

export const useCertificateStore = defineStore("certificates", () =>
  useCachedCollection({
    newItem: certificate.newItem,
    maxAge: 30_000,
    fetchFn: useHonoApi(() => client.api.certificates.$get()),
    removeFn: useHonoApi((id: string) =>
      client.api.certificates[":id"].$delete({ param: { id } }),
    ),
    upsertFn: useHonoApi((json: certificate.Certificate) =>
      client.api.certificates.$put({ json }),
    ),
    upsertSchema: certificate.upsert.body,
  }),
);
