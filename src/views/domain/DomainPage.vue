<script setup lang="ts">
import { useDomainStore } from "@/stores/domains";
import DomainList from "./DomainList.vue";
import DomainEditor from "./DomainEditor.vue";
import { PageEntry } from "@/components/acrux-ui/page";
import { useFormModel } from "@/components/acrux-ui/actions";

const { useAll } = useDomainStore();
const { create } = useFormModel(DomainEditor);

const [items, status, refresh] = useAll();
</script>

<template>
  <PageEntry
    title="域名"
    description="需要签发证书的域名，绑定 DNS 凭据以完成 DNS-01 验证"
    :loading="status.loading"
    :error="status.error"
    :items="items"
    :on-retry="() => refresh()"
    :on-create="create"
  >
    <DomainList />
  </PageEntry>
</template>
