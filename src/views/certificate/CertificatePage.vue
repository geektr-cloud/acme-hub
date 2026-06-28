<script setup lang="ts">
import { useCertificateStore } from "@/stores/certificates";
import CertificateList from "./CertificateList.vue";
import { PageEntry } from "@/components/acrux-ui/page";

const { useAll } = useCertificateStore();
const [items, status, refresh] = useAll();
</script>

<template>
  <PageEntry
    title="证书"
    description="签发流程生成的证书（只读）"
    :loading="status.loading"
    :error="status.error"
    :items="items"
    hide-create
    @retry="void refresh()"
  >
    <CertificateList />
  </PageEntry>
</template>
