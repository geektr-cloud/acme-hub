<script setup lang="ts">
import { useClientStore } from "@/stores/clients";
import ClientList from "./ClientList.vue";
import ClientEditor from "./ClientEditor.vue";
import { PageEntry } from "@/components/acrux-ui/page";
import { useFormModel } from "@/components/acrux-ui/actions";

const { useAll } = useClientStore();
const { create } = useFormModel(ClientEditor);

const [items, status, refresh] = useAll();
</script>

<template>
  <PageEntry
    title="客户端"
    description="持 token 调用本服务的消费方，allow 限定其可申请的域名范围"
    :loading="status.loading"
    :error="status.error"
    :items="items"
    @retry="void refresh()"
    @create="create()"
  >
    <ClientList />
  </PageEntry>
</template>
