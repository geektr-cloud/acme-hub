<script setup lang="ts">
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import AcmeAccountList from "./AcmeAccountList.vue";
import AcmeAccountEditor from "./AcmeAccountEditor.vue";
import { PageEntry } from "@/components/acrux-ui/page";
import { useFormModel } from "@/components/acrux-ui/actions";

const { useAll } = useAcmeAccountStore();
const { create } = useFormModel(AcmeAccountEditor);

const [items, status, refresh] = useAll();
</script>

<template>
  <PageEntry
    title="ACME 账户"
    description="对接 CA（Let's Encrypt / ZeroSSL 等）的账户与密钥"
    :loading="status.loading"
    :error="status.error"
    :items="items"
    @retry="void refresh()"
    @create="create()"
  >
    <AcmeAccountList />
  </PageEntry>
</template>
