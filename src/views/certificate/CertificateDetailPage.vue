<script setup lang="ts">
import { computed, watch } from "vue";
import { PageDetail } from "@/components/acrux-ui/page";
import { RemovalButton } from "@/components/acrux-ui/actions";
import {
  DataItem,
  DataView,
  DateFormatter,
  Pem,
  UUID,
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
import { useCertificateStore } from "@/stores/certificates";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import { client } from "@/utils/api";

const id = useRouteParams<string>("id");
const { useRemoval } = useCertificateStore();

const fetchItem = useHonoApi(() =>
  client.api.certificates[":id"].$get({ param: { id: id.value } }),
);
const [item, status, reload] = useAsyncState(fetchItem, undefined, {
  immediate: true,
});
const removal = useRemoval(id);

const { useAll: useAllAccounts } = useAcmeAccountStore();
const [accounts] = useAllAccounts();
const account = computed(() => {
  const aid = item.value?.acmeAccountId;
  if (!aid) return null;
  return (
    accounts.value.find((a) => a.id === aid) ?? { id: aid, name: "未知账户" }
  );
});

watch(id, () => void reload());
</script>

<template>
  <PageDetail
    :loading="status.loading"
    :error="status.error"
    :on-retry="reload"
  >
    <template v-if="item">
      <Card>
        <CardHeader>
          <CardTitle class="text-base font-mono">{{
            item.commonName || "证书详情"
          }}</CardTitle>
          <CardAction>
            <RemovalButton
              :ctx="removal"
              confirm="确定删除此证书？不可恢复。"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataView>
            <DataItem label="ID">
              <UUID :value="item.id" :short="0" />
            </DataItem>
            <DataItem label="通用名称">
              <code class="font-mono">{{ item.commonName || "(无)" }}</code>
            </DataItem>
            <DataItem label="SAN">
              <span v-if="item.sans.length" class="inline-flex flex-wrap gap-1">
                <Badge v-for="d in item.sans" :key="d" variant="outline">{{
                  d
                }}</Badge>
              </span>
              <span v-else class="text-zinc-500">无</span>
            </DataItem>
            <DataItem label="签发账户">
              <Badge v-if="account" variant="secondary">{{
                account.name
              }}</Badge>
              <span v-else class="text-zinc-500">未关联</span>
            </DataItem>
            <DataItem label="私钥">
              <Pem v-if="item.privateKey" :value="item.privateKey" copy />
              <span v-else class="text-zinc-500">(无)</span>
            </DataItem>
            <DataItem label="证书">
              <Pem v-if="item.certificate" :value="item.certificate" copy />
              <span v-else class="text-zinc-500">(无)</span>
            </DataItem>
            <DataItem label="证书链">
              <Pem v-if="item.chain" :value="item.chain" copy />
              <span v-else class="text-zinc-500">(无)</span>
            </DataItem>
            <DataItem label="CSR">
              <Pem v-if="item.csr" :value="item.csr" copy />
              <span v-else class="text-zinc-500">(无)</span>
            </DataItem>
            <DataItem label="配置 (config)">
              <pre
                class="w-full overflow-auto text-xs whitespace-pre-wrap break-all"
                >{{ JSON.stringify(item.config, null, 2) }}</pre
              >
            </DataItem>
            <DataItem label="创建时间">
              <DateFormatter :value="item.createdAt" />
            </DataItem>
            <DataItem label="更新时间">
              <DateFormatter :value="item.updatedAt" addition-distance />
            </DataItem>
          </DataView>
        </CardContent>
      </Card>
    </template>
  </PageDetail>
</template>
