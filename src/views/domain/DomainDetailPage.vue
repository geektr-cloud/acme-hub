<script setup lang="ts">
import { computed, watch } from "vue";
import { PageDetail } from "@/components/acrux-ui/page";
import { RemovalButton, useFormModel } from "@/components/acrux-ui/actions";
import {
  CopyBtn,
  DataItem,
  DataView,
  DateFormatter,
  VSeparator,
} from "@/components/acrux-ui/display";
import { useRouteParams } from "@vueuse/router";
import { useAsyncState, useHonoApi } from "@acrux/core";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDomainStore } from "@/stores/domains";
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import { client } from "@/utils/api";
import { Edit } from "@lucide/vue";
import DomainEditor from "./DomainEditor.vue";

const id = useRouteParams<string>("id");
const { useRemoval } = useDomainStore();
const { update } = useFormModel(DomainEditor);

const fetchItem = useHonoApi(() =>
  client.api.domains[":id"].$get({ param: { id: id.value } }),
);
const [item, status, reload] = useAsyncState(fetchItem, undefined, {
  immediate: true,
});
const removal = useRemoval(id);

const { useAll: useAllCredentials } = useDnsCredentialStore();
const [credentials] = useAllCredentials();
const credential = computed(() => {
  const did = item.value?.dnsCredentialId;
  if (!did) return null;
  return (
    credentials.value.find((c) => c.id === did) ?? { id: did, name: "未知凭据" }
  );
});

watch(id, () => void reload());
</script>

<template>
  <PageDetail :loading="status.loading" :error="status.error" @retry="reload">
    <template v-if="item">
      <Card>
        <CardHeader>
          <CardTitle class="text-base font-mono">{{
            item.name || "域名详情"
          }}</CardTitle>
          <CardAction>
            <Button variant="secondary" @click="update(item!.id)">
              <Edit />
            </Button>
            <RemovalButton :ctx="removal" confirm="确定删除此域名？" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataView>
            <DataItem label="域名">
              <span class="font-mono">{{ item.name || "(未命名)" }}</span>
            </DataItem>
            <DataItem label="描述">{{ item.description || "(无)" }}</DataItem>
            <DataItem label="DNS 凭据">
              <Badge v-if="credential" variant="secondary">{{
                credential.name
              }}</Badge>
              <span v-else class="text-zinc-500"
                >未绑定 — 暂不可用于证书签发</span
              >
            </DataItem>
            <DataItem label="创建时间">
              <DateFormatter :value="item.createdAt" />
            </DataItem>
            <DataItem label="更新时间">
              <DateFormatter :value="item.updatedAt" />
              <VSeparator />
              <DateFormatter
                :value="item.updatedAt"
                format="distance"
                class="text-zinc-500"
              />
            </DataItem>
            <DataItem label="ID">
              {{ item.id }}
              <VSeparator />
              <CopyBtn :value="item.id" />
            </DataItem>
          </DataView>
        </CardContent>
      </Card>
    </template>
  </PageDetail>
</template>
