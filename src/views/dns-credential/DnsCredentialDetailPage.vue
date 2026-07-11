<script setup lang="ts">
import { watch } from "vue";
import { PageDetail } from "@/components/acrux-ui/page";
import { RemovalButton, useFormModel } from "@/components/acrux-ui/actions";
import {
  DataItem,
  DataView,
  DateFormatter,
  Token as TokenDisplay,
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
import { Button } from "@/components/ui/button";
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import { client } from "@/utils/api";
import { Edit } from "@lucide/vue";
import DnsCredentialEditor from "./DnsCredentialEditor.vue";

const id = useRouteParams<string>("id");
const { useRemoval } = useDnsCredentialStore();
const { update } = useFormModel(DnsCredentialEditor);

const fetchItem = useHonoApi(() =>
  client.api["dns-credentials"][":id"].$get({ param: { id: id.value } }),
);
const [item, status, reload] = useAsyncState(fetchItem, undefined, {
  immediate: true,
});
const removal = useRemoval(id);

const providerLabel = (p: string) =>
  p === "cloudflare" ? "Cloudflare" : p === "alicloud" ? "阿里云" : p;

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
          <CardTitle class="text-base">{{
            item.name || "DNS 凭据详情"
          }}</CardTitle>
          <CardAction>
            <Button variant="secondary" @click="update(item!.id)">
              <Edit />
            </Button>
            <RemovalButton
              :ctx="removal"
              confirm="确定删除此 DNS 凭据？绑定的域名将解除关联。"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataView>
            <DataItem label="ID">
              <UUID :value="item.id" :short="0" />
            </DataItem>
            <DataItem label="名称">{{ item.name || "(未命名)" }}</DataItem>
            <DataItem label="描述">{{ item.description || "(无)" }}</DataItem>
            <DataItem label="服务商">
              <Badge variant="secondary">{{
                providerLabel(item.provider)
              }}</Badge>
            </DataItem>

            <template v-if="item.provider === 'cloudflare'">
              <DataItem label="API Token">
                <TokenDisplay
                  v-if="item.creds && 'apiToken' in item.creds"
                  :value="item.creds.apiToken"
                />
                <span v-else class="text-zinc-500">(无)</span>
              </DataItem>
            </template>

            <template v-else-if="item.provider === 'alicloud'">
              <DataItem label="AccessKey ID">
                <TokenDisplay
                  v-if="item.creds && 'accessKeyId' in item.creds"
                  :value="item.creds.accessKeyId"
                />
                <span v-else class="text-zinc-500">(无)</span>
              </DataItem>
              <DataItem label="AccessKey Secret">
                <TokenDisplay
                  v-if="item.creds && 'accessKeySecret' in item.creds"
                  :value="item.creds.accessKeySecret"
                />
                <span v-else class="text-zinc-500">(无)</span>
              </DataItem>
            </template>

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
