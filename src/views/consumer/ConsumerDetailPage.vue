<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { VueFinalModal, useModal } from "vue-final-modal";
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
import { useConsumerStore } from "@/stores/consumers";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import { client } from "@/utils/api";
import type { pki } from "@server/core/pki";
import { Edit, Plus, RefreshCw, ShieldCheck } from "@lucide/vue";
import { useRouter } from "vue-router";
import { Spinner } from "@/components/ui/spinner";
import ConsumerEditor from "./ConsumerEditor.vue";
import RequestCertModal from "@/views/certificate/RequestCertModal.vue";

const id = useRouteParams<string>("id");
const router = useRouter();
const { useRemoval } = useConsumerStore();
const { update } = useFormModel(ConsumerEditor);

const fetchItem = useHonoApi(() =>
  client.api.consumers[":id"].$get({ param: { id: id.value } }),
);
const [item, status, reload] = useAsyncState(fetchItem, undefined, {
  immediate: true,
});
const removal = useRemoval(id);

// 匹配到的证书：走对外端点，用该消费方自己的 Bearer token 鉴权（同 allow 规则过滤）。
const certs = ref<pki.CertListItem[]>([]);
const certsLoading = ref(false);
const certsError = ref<string | null>(null);

async function loadCerts(token: string | undefined) {
  if (!token) {
    certs.value = [];
    return;
  }
  certsLoading.value = true;
  certsError.value = null;
  try {
    const res = await client.pki.v1.certificates.$get(
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    certs.value = (await res.json()).certs;
  } catch (e) {
    certsError.value = e instanceof Error ? e.message : String(e);
    certs.value = [];
  } finally {
    certsLoading.value = false;
  }
}

watch(
  () => item.value?.token,
  (token) => void loadCerts(token),
  { immediate: true },
);

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

const {
  open: openCertModal,
  close: closeCertModal,
  destroy: destroyCertModal,
} = useModal({
  component: defineComponent({
    setup(_props, { expose }) {
      const clientRef = ref(item.value);
      expose({ setClient: (c: typeof item.value) => (clientRef.value = c) });
      return () =>
        h(
          VueFinalModal,
          {
            class: "flex overflow-y-auto",
            contentClass: "m-auto",
            focusTrap: false,
            zIndexFn: ({ index }) => 50 + index,
          },
          {
            default: () =>
              h(Card, null, {
                default: () =>
                  h(CardContent, null, {
                    default: () =>
                      h(RequestCertModal, {
                        onClose: () => {
                          closeCertModal();
                          void loadCerts(item.value?.token);
                        },
                        client: clientRef.value ?? undefined,
                      }),
                  }),
              }),
          },
        );
    },
  }),
});

function onRequestCert() {
  closeCertModal();
  nextTick(() => openCertModal());
}

onUnmounted(destroyCertModal);

const rotateToken = async () => {
  const res = await client.api.consumers[":id"]["rotate-token"].$post({
    param: { id: id.value },
  });
  if (res.ok) {
    item.value = await res.json();
    void loadCerts(item.value?.token);
  }
};

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
            item.name || "消费方详情"
          }}</CardTitle>
          <CardAction>
            <Button variant="secondary" @click="update(item!.id)">
              <Edit />
            </Button>
            <RemovalButton
              :ctx="removal"
              confirm="确定删除此消费方？不可恢复。"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataView>
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
              <VSeparator />
              <Button
                variant="ghost"
                size="icon"
                class="size-3.5"
                title="轮换 token"
                @click="rotateToken"
              >
                <RefreshCw class="size-3.5 shrink-0" />
              </Button>
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
            <DataItem label="ID">
              {{ item.id }}
              <VSeparator />
              <CopyBtn :value="item.id" />
            </DataItem>
          </DataView>
        </CardContent>
      </Card>

      <Card class="mt-4">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <ShieldCheck class="size-4" />
            证书列表
            <Badge v-if="!certsLoading" variant="secondary">{{
              certs.length
            }}</Badge>
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              title="申请证书"
              :disabled="!item.token"
              @click="onRequestCert()"
            >
              <Plus class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              title="刷新"
              :disabled="certsLoading || !item.token"
              @click="loadCerts(item!.token)"
            >
              <RefreshCw class="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div
            v-if="certsLoading"
            class="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Spinner class="size-4" />
            加载中…
          </div>
          <div v-else-if="certsError" class="text-sm text-destructive">
            加载失败：{{ certsError }}
          </div>
          <div v-else-if="!item.token" class="text-sm text-zinc-500">
            消费方无 token，无法查询证书。
          </div>
          <div v-else-if="certs.length === 0" class="text-sm text-zinc-500">
            无匹配证书。
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="cert in certs"
              :key="cert.id"
              class="flex cursor-pointer flex-col gap-1.5 border p-3 transition-colors hover:bg-muted/50"
              @click="router.push(`/certificates/${cert.id}`)"
            >
              <div class="flex items-center justify-between gap-2">
                <code class="font-mono text-sm">{{ cert.commonName }}</code>
                <span class="shrink-0 text-xs text-zinc-500">
                  <template v-if="cert.notAfter">
                    到期
                    <DateFormatter :value="cert.notAfter" format="distance" />
                  </template>
                  <span v-else>—</span>
                </span>
              </div>
              <div v-if="cert.sans.length" class="flex flex-wrap gap-1">
                <Badge
                  v-for="d in cert.sans"
                  :key="d"
                  variant="secondary"
                  class="font-mono text-xs"
                  >{{ d }}</Badge
                >
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </PageDetail>
</template>
