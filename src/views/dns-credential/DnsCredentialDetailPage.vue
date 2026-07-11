<script setup lang="ts">
import { ref, watch } from "vue";
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
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import { client } from "@/utils/api";
import { Edit, Eye, EyeOff } from "@lucide/vue";
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

const showSecrets = ref(false);

const providerLabel = (p: string) =>
  p === "cloudflare" ? "Cloudflare" : p === "alicloud" ? "阿里云" : p;

const mask = (v: string | undefined) => (v ? "••••••••" : "(无)");

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
            <DataItem label="名称">{{ item.name || "(未命名)" }}</DataItem>
            <DataItem label="描述">{{ item.description || "(无)" }}</DataItem>
            <DataItem label="服务商">
              <Badge variant="secondary">{{
                providerLabel(item.provider)
              }}</Badge>
            </DataItem>

            <template v-if="item.provider === 'cloudflare'">
              <DataItem label="API Token">
                <template
                  v-if="showSecrets && item.creds && 'apiToken' in item.creds"
                >
                  <code class="font-mono text-xs break-all">{{
                    item.creds.apiToken
                  }}</code>
                  <VSeparator />
                  <CopyBtn :value="item.creds.apiToken" />
                </template>
                <template v-else>
                  {{
                    mask(
                      item.creds && "apiToken" in item.creds
                        ? item.creds.apiToken
                        : undefined,
                    )
                  }}
                </template>
              </DataItem>
            </template>

            <template v-else-if="item.provider === 'alicloud'">
              <DataItem label="AccessKey ID">
                <template
                  v-if="
                    showSecrets && item.creds && 'accessKeyId' in item.creds
                  "
                >
                  <code class="font-mono text-xs break-all">{{
                    item.creds.accessKeyId
                  }}</code>
                  <VSeparator />
                  <CopyBtn :value="item.creds.accessKeyId" />
                </template>
                <template v-else>
                  {{
                    mask(
                      item.creds && "accessKeyId" in item.creds
                        ? item.creds.accessKeyId
                        : undefined,
                    )
                  }}
                </template>
              </DataItem>
              <DataItem label="AccessKey Secret">
                <template
                  v-if="
                    showSecrets && item.creds && 'accessKeySecret' in item.creds
                  "
                >
                  <code class="font-mono text-xs break-all">{{
                    item.creds.accessKeySecret
                  }}</code>
                  <VSeparator />
                  <CopyBtn :value="item.creds.accessKeySecret" />
                </template>
                <template v-else>
                  {{
                    mask(
                      item.creds && "accessKeySecret" in item.creds
                        ? item.creds.accessKeySecret
                        : undefined,
                    )
                  }}
                </template>
              </DataItem>
            </template>

            <DataItem label="凭据">
              <Button
                variant="ghost"
                size="sm"
                @click="showSecrets = !showSecrets"
              >
                <Eye v-if="!showSecrets" class="size-3.5" />
                <EyeOff v-else class="size-3.5" />
                {{ showSecrets ? "隐藏" : "显示" }}
              </Button>
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
