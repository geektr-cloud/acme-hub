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
import { Button } from "@/components/ui/button";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import { client } from "@/utils/api";
import { Edit } from "@lucide/vue";
import AcmeAccountEditor from "./AcmeAccountEditor.vue";
import { isEab } from "./acme";

const id = useRouteParams<string>("id");
const { useRemoval } = useAcmeAccountStore();
const { update } = useFormModel(AcmeAccountEditor);

const fetchItem = useHonoApi(() =>
  client.api["acme-accounts"][":id"].$get({ param: { id: id.value } }),
);
const [item, status, reload] = useAsyncState(fetchItem, undefined, {
  immediate: true,
});
const removal = useRemoval(id);

const showEab = computed(() => isEab(item.value?.acmeUrl));

watch(id, () => void reload());
</script>

<template>
  <PageDetail :loading="status.loading" :error="status.error" @retry="reload">
    <template v-if="item">
      <Card>
        <CardHeader>
          <CardTitle class="text-base">{{
            item.name || "ACME 账户详情"
          }}</CardTitle>
          <CardAction>
            <Button variant="secondary" @click="update(item!.id)">
              <Edit />
            </Button>
            <RemovalButton
              :ctx="removal"
              confirm="确定删除此账户？引用它的客户端与证书会解除关联。"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataView>
            <DataItem label="名称">{{ item.name || "(未命名)" }}</DataItem>
            <DataItem label="描述">{{ item.description || "(无)" }}</DataItem>
            <DataItem label="邮箱">{{ item.email || "(无)" }}</DataItem>
            <DataItem label="目录 URL">{{ item.acmeUrl || "(无)" }}</DataItem>
            <DataItem label="账户 URL">
              {{ item.creds?.accountUrl || "(无)" }}
              <template v-if="item.creds?.accountUrl">
                <VSeparator />
                <CopyBtn :value="item.creds.accountUrl" />
              </template>
            </DataItem>
            <DataItem v-if="showEab" label="EAB Kid">
              <code
                v-if="item.creds?.eab?.kid"
                class="font-mono text-xs break-all"
                >{{ item.creds.eab.kid }}</code
              >
              <span v-else class="text-zinc-500">(无)</span>
              <template v-if="item.creds?.eab?.kid">
                <VSeparator />
                <CopyBtn :value="item.creds.eab.kid" />
              </template>
            </DataItem>
            <DataItem v-if="showEab" label="EAB HMAC Key">
              <code
                v-if="item.creds?.eab?.hmacKey"
                class="font-mono text-xs break-all"
                >{{ item.creds.eab.hmacKey }}</code
              >
              <span v-else class="text-zinc-500">(无)</span>
              <template v-if="item.creds?.eab?.hmacKey">
                <VSeparator />
                <CopyBtn :value="item.creds.eab.hmacKey" />
              </template>
            </DataItem>
            <DataItem label="私钥">
              <div
                v-if="item.creds?.privateKey"
                class="flex w-full flex-col gap-1"
              >
                <details>
                  <summary
                    class="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200"
                  >
                    点击展开私钥
                  </summary>
                  <pre
                    class="mt-1 max-h-60 overflow-auto rounded bg-zinc-900 p-2 font-mono text-xs whitespace-pre-wrap break-all"
                    >{{ item.creds.privateKey }}</pre
                  >
                </details>
                <CopyBtn :value="item.creds.privateKey" />
              </div>
              <span v-else class="text-zinc-500">(无)</span>
            </DataItem>
            <DataItem label="公钥">
              <div
                v-if="item.creds?.publicKey"
                class="flex w-full flex-col gap-1"
              >
                <details>
                  <summary
                    class="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200"
                  >
                    点击展开公钥
                  </summary>
                  <pre
                    class="mt-1 max-h-60 overflow-auto rounded bg-zinc-900 p-2 font-mono text-xs whitespace-pre-wrap break-all"
                    >{{ item.creds.publicKey }}</pre
                  >
                </details>
                <CopyBtn :value="item.creds.publicKey" />
              </div>
              <span v-else class="text-zinc-500">(无)</span>
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
