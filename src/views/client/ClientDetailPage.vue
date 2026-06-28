<script setup lang="ts">
import { computed, watch } from "vue";
import { PageDetail } from "@/components/acrux-ui/page";
import { RemovalButton, useFormModel } from "@/components/acrux-ui/actions";
import {
  CopyBtn,
  CopyTag,
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
import { useClientStore } from "@/stores/clients";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import { client } from "@/utils/api";
import { Edit } from "@lucide/vue";
import ClientEditor from "./ClientEditor.vue";

const id = useRouteParams<string>("id");
const { useRemoval } = useClientStore();
const { update } = useFormModel(ClientEditor);

const fetchItem = useHonoApi(() =>
  client.api.clients[":id"].$get({ param: { id: id.value } }),
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

const ruleLabel = (type: string) => (type === "suffix" ? "后缀" : "全文");

watch(id, () => void reload());
</script>

<template>
  <PageDetail :loading="status.loading" :error="status.error" @retry="reload">
    <template v-if="item">
      <Card>
        <CardHeader>
          <CardTitle class="text-base">{{
            item.name || "客户端详情"
          }}</CardTitle>
          <CardAction>
            <Button variant="secondary" @click="update(item!.id)">
              <Edit />
            </Button>
            <RemovalButton
              :ctx="removal"
              confirm="确定删除此客户端？不可恢复。"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataView>
            <DataItem label="ID">
              {{ item.id }}
              <VSeparator />
              <CopyBtn :value="item.id" />
            </DataItem>
            <DataItem label="名称">{{ item.name || "(未命名)" }}</DataItem>
            <DataItem label="描述">{{ item.description || "(无)" }}</DataItem>
            <DataItem label="Token">
              <code class="font-mono text-xs break-all">{{
                item.token || "(无)"
              }}</code>
              <template v-if="item.token">
                <VSeparator />
                <CopyBtn :value="item.token" />
              </template>
            </DataItem>
            <DataItem label="绑定账户">
              <Badge v-if="account" variant="secondary">{{
                account.name
              }}</Badge>
              <span v-else class="text-zinc-500">未绑定</span>
            </DataItem>
            <DataItem label="允许的域名规则">
              <div class="flex w-full flex-col gap-1">
                <div
                  v-for="(rule, i) in item.allow"
                  :key="i"
                  class="flex items-center gap-2"
                >
                  <Badge variant="outline">{{ ruleLabel(rule.type) }}</Badge>
                  <CopyTag :value="rule.pattern" variant="secondary" />
                </div>
                <span v-if="item.allow.length === 0" class="text-zinc-500"
                  >无</span
                >
              </div>
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
          </DataView>
        </CardContent>
      </Card>
    </template>
  </PageDetail>
</template>
