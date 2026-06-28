<script setup lang="ts">
import { computed, watch } from "vue";
import { PageDetail } from "@/components/acrux-ui/page";
import { RemovalButton } from "@/components/acrux-ui/actions";
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

// PEM 块定义，便于统一渲染。
const pemBlocks = computed(() => [
  { label: "私钥 (key)", value: item.value?.key ?? "" },
  { label: "证书 (cer)", value: item.value?.cer ?? "" },
  { label: "证书链 (ca)", value: item.value?.ca ?? "" },
  { label: "CSR", value: item.value?.csr ?? "" },
]);

watch(id, () => void reload());
</script>

<template>
  <PageDetail :loading="status.loading" :error="status.error" @retry="reload">
    <template v-if="item">
      <Card>
        <CardHeader>
          <CardTitle class="text-base font-mono">{{
            item.domain || "证书详情"
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
            <DataItem label="主域名">
              <code class="font-mono">{{ item.domain || "(无)" }}</code>
            </DataItem>
            <DataItem label="SAN">
              <span v-if="item.alt.length" class="inline-flex flex-wrap gap-1">
                <Badge v-for="d in item.alt" :key="d" variant="outline">{{
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
            <DataItem
              v-for="block in pemBlocks"
              :key="block.label"
              :label="block.label"
            >
              <div v-if="block.value" class="flex w-full flex-col gap-1">
                <details>
                  <summary
                    class="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200"
                  >
                    点击展开
                  </summary>
                  <pre
                    class="mt-1 max-h-60 overflow-auto rounded bg-zinc-900 p-2 font-mono text-xs whitespace-pre-wrap break-all"
                    >{{ block.value }}</pre
                  >
                </details>
                <CopyBtn :value="block.value" />
              </div>
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
