<script setup lang="ts">
import { useConsumerStore } from "@/stores/consumers";
import ConsumerList from "./ConsumerList.vue";
import ConsumerEditor from "./ConsumerEditor.vue";
import { PageEntry } from "@/components/acrux-ui/page";
import { useFormModel } from "@/components/acrux-ui/actions";

const { useAll } = useConsumerStore();
const { create } = useFormModel(ConsumerEditor);

const [items, status, refresh] = useAll();
</script>

<template>
  <PageEntry
    title="消费方"
    description="持 token 调用本服务的消费方，allow 限定其可申请的域名范围"
    :loading="status.loading"
    :error="status.error"
    :items="items"
    :on-retry="() => refresh()"
    :on-create="create"
  >
    <ConsumerList />
  </PageEntry>
</template>
