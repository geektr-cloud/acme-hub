<script setup lang="ts">
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import DnsCredentialList from "./DnsCredentialList.vue";
import DnsCredentialEditor from "./DnsCredentialEditor.vue";
import { PageEntry } from "@/components/acrux-ui/page";
import { useFormModel } from "@/components/acrux-ui/actions";

const { useAll } = useDnsCredentialStore();
const { create } = useFormModel(DnsCredentialEditor);

const [items, status, refresh] = useAll();
</script>

<template>
  <PageEntry
    title="DNS 凭据"
    description="用于操作 DNS API 的凭据，签发证书时自动完成 DNS-01 验证"
    :loading="status.loading"
    :error="status.error"
    :items="items"
    :on-retry="() => refresh()"
    :on-create="create"
  >
    <DnsCredentialList />
  </PageEntry>
</template>
