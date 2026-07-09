<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import {
  useFetchEventSource,
  SseResponseError,
} from "@geektr/vue-fetch-event-source";
import { useClientStore } from "@/stores/clients";
import { useCertificateStore } from "@/stores/certificates";
import type { acmeV1 } from "@server/core/acme-v1";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

defineProps<{ onClose: () => void }>();

const { useAll: useAllClients } = useClientStore();
const { useAll: useAllCerts } = useCertificateStore();
const [clients] = useAllClients();
const [, , refreshCerts] = useAllCerts();

const selectedClientId = ref("");
const domainsInput = ref("");
const events = ref<acmeV1.CertEvent[]>([]);
const running = ref(false);

const selectedClient = computed(() =>
  clients.value.find((c) => c.id === selectedClientId.value),
);

const parsedDomains = computed(() =>
  domainsInput.value
    .split(/[\n,]+/)
    .map((d) => d.trim())
    .filter(Boolean),
);

const eventsEl = useTemplateRef<HTMLElement>("eventsEl");

async function scrollToBottom() {
  await nextTick();
  if (eventsEl.value) {
    eventsEl.value.scrollTop = eventsEl.value.scrollHeight;
  }
}

function pushEvent(e: acmeV1.CertEvent) {
  if (e.type === "acme-progress") {
    const last = events.value[events.value.length - 1];
    if (last?.type === "acme-progress" && last.event === e.event) {
      events.value.splice(events.value.length - 1, 1, e);
      void scrollToBottom();
      return;
    }
  }
  events.value.push(e);
  void scrollToBottom();
  if (e.type === "done") void refreshCerts();
}

function progressText(e: acmeV1.CertEvent & { type: "acme-progress" }): string {
  const d = e.detail;
  switch (e.event) {
    case "dns:txt-check":
      return `🔍 检查 TXT 记录 ${d.recordName ?? ""}`;
    case "dns:txt-found":
      return `✓ TXT 记录已生效`;
    case "dns:txt-miss":
      return `⏳ TXT 记录未生效，等待 DNS 传播…`;
    case "challenge:verify":
      return `🔍 预验证 ${d.domain ?? ""}（第 ${d.attempts ?? "?"} 次）`;
    case "challenge:complete":
      return `✓ 挑战完成 ${d.domain ?? ""}`;
    case "challenge:error":
      return `⚠ 挑战出错 ${d.domain ?? ""}: ${d.message ?? ""}`;
    case "status:poll":
      return `⏳ 订单状态 ${d.status ?? ""}`;
    case "order:create":
      return `📋 订单创建中…`;
    case "order:created":
      return `📋 订单已创建`;
    case "order:finalize":
      return `📋 订单完成中…`;
    default:
      return `· ${e.event}`;
  }
}

const { status, error, open, close } = useFetchEventSource(
  "/api/acme/v1/cert/sse",
  ["cert"],
  {
    method: "POST",
    immediate: false,
    onEvent(msg) {
      try {
        pushEvent(JSON.parse(String(msg.data)) as acmeV1.CertEvent);
      } catch {
        // ignore malformed events
      }
    },
  },
);

watch(status, (s) => {
  if (s === "CLOSED") running.value = false;
});

watch(error, (e) => {
  if (e == null) return;
  if (e instanceof SseResponseError) {
    pushEvent({ type: "error", status: e.status, message: e.message });
  } else {
    pushEvent({
      type: "error",
      status: 0,
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

function submit() {
  if (!selectedClient.value || !parsedDomains.value.length || running.value)
    return;
  running.value = true;
  events.value = [];
  open({
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${selectedClient.value.token}`,
    },
    body: JSON.stringify({ domains: parsedDomains.value }),
  });
}

function cancel() {
  close();
}
</script>

<template>
  <div class="w-[560px] max-h-[80vh] flex flex-col gap-4 p-6">
    <h2 class="text-lg font-semibold">请求证书</h2>

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">客户端</label>
        <Select v-model="selectedClientId" :disabled="running">
          <SelectTrigger>
            <SelectValue placeholder="选择客户端" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="c in clients" :key="c.id" :value="c.id">
              {{ c.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div
          v-if="selectedClient?.allow.length"
          class="flex flex-wrap gap-1 mt-1"
        >
          <Badge
            v-for="(rule, i) in selectedClient.allow"
            :key="i"
            variant="outline"
            class="text-xs"
          >
            {{ rule.type }}:{{ rule.pattern }}
          </Badge>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">域名</label>
        <Textarea
          v-model="domainsInput"
          placeholder="example.com
api.example.com（每行一个，支持逗号分隔）"
          :disabled="running"
          rows="3"
        />
        <div v-if="parsedDomains.length" class="flex flex-wrap gap-1">
          <Badge
            v-for="d in parsedDomains"
            :key="d"
            variant="secondary"
            class="text-xs"
          >
            {{ d }}
          </Badge>
        </div>
      </div>

      <div class="flex gap-2">
        <Button
          v-if="!running"
          :disabled="!selectedClientId || !parsedDomains.length"
          @click="submit()"
        >
          发起请求
        </Button>
        <Button v-else variant="outline" @click="cancel()"> 取消 </Button>
      </div>
    </div>

    <div
      v-if="events.length"
      ref="eventsEl"
      class="flex flex-col gap-1 overflow-y-auto max-h-[40vh] border rounded-md p-3 text-sm font-mono bg-muted/30"
    >
      <div
        v-for="(e, i) in events"
        :key="i"
        :class="{
          'text-destructive': e.type === 'error',
          'text-green-600': e.type === 'done',
        }"
      >
        <template v-if="e.type === 'start'">
          ▶ 开始处理
          <Badge v-for="d in e.domains" :key="d" variant="secondary">{{
            d
          }}</Badge>
          客户端 <Badge variant="secondary">{{ e.client }}</Badge>
        </template>
        <template v-else-if="e.type === 'allow-matched'">
          ✓ <Badge variant="secondary">{{ e.domain }}</Badge>
          命中规则
          <Badge variant="outline"
            >{{ e.rule.type }}:{{ e.rule.pattern }}</Badge
          >
        </template>
        <template v-else-if="e.type === 'account'">
          🔑 ACME 账户
          <Badge variant="secondary">{{ e.name }}</Badge>
        </template>
        <template v-else-if="e.type === 'decision'">
          {{ e.mode === "cache" ? "💾" : e.mode === "renew" ? "🔄" : "🆕" }}
          {{
            e.mode === "cache" ? "缓存" : e.mode === "renew" ? "续期" : "新签"
          }}
          — {{ e.reason }}
        </template>
        <template v-else-if="e.type === 'cache-hit'">
          💾 缓存命中，有效期至 {{ new Date(e.notAfter).toLocaleDateString() }}
        </template>
        <template v-else-if="e.type === 'zone'">
          🌐 <Badge variant="secondary">{{ e.domain }}</Badge> DNS zone
          <Badge>{{ e.zone }}</Badge> 凭据
          <Badge variant="secondary"
            >{{ e.credential }} ({{ e.provider }})</Badge
          >
        </template>
        <template v-else-if="e.type === 'keygen'">
          {{ e.reused ? "♻️ 复用旧密钥" : "🔑 生成新密钥" }}
        </template>
        <template v-else-if="e.type === 'dns-add'">
          📝 DNS 记录添加 <code class="text-xs">{{ e.fqdn }}</code>
        </template>
        <template v-else-if="e.type === 'dns-remove'">
          🗑️ DNS 记录移除 <code class="text-xs">{{ e.fqdn }}</code>
        </template>
        <template v-else-if="e.type === 'issued'">
          ✅ 证书签发完成，有效期至
          {{ new Date(e.notAfter).toLocaleDateString() }}
        </template>
        <template v-else-if="e.type === 'saved'">
          💾 证书已{{ e.mode === "renew" ? "更新" : "保存" }}
        </template>
        <template v-else-if="e.type === 'done'">
          ✅ 完成！有效期至
          {{ new Date(e.result.notAfter).toLocaleDateString() }}
        </template>
        <template v-else-if="e.type === 'acme-progress'">
          <span class="text-muted-foreground">{{ progressText(e) }}</span>
        </template>
        <template v-else-if="e.type === 'error'">
          ❌ 错误 ({{ e.status }}): {{ e.message }}
        </template>
      </div>
    </div>

    <div
      v-if="running"
      class="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner class="size-4" />
      处理中…
    </div>
  </div>
</template>
