<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import {
  useFetchEventSource,
  SseResponseError,
} from "@geektr/vue-fetch-event-source";
import { useConsumerStore } from "@/stores/consumers";
import { useCertificateStore } from "@/stores/certificates";
import type { pki } from "@server/core/pki";
import type { consumer as consumerSchema } from "@server/core/consumers";
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

const props = defineProps<{
  onClose: () => void;
  client?: consumerSchema.Consumer;
}>();

const { useAll: useAllConsumers } = useConsumerStore();
const { useAll: useAllCerts } = useCertificateStore();
const [clients] = useAllConsumers();
const [, , refreshCerts] = useAllCerts();

const selectedClientId = ref(props.client?.id ?? "");
const domainsInput = ref("");
const events = ref<pki.CertEvent[]>([]);
const running = ref(false);

const selectedClient = computed(
  () =>
    props.client ?? clients.value.find((c) => c.id === selectedClientId.value),
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

function pushEvent(e: pki.CertEvent) {
  events.value.push(e);
  void scrollToBottom();
  if (e.type === "completed") void refreshCerts();
}

const { status, error, open, close } = useFetchEventSource(
  "/pki/v1/certificates/issue",
  ["cert"],
  {
    method: "POST",
    immediate: false,
    onEvent(msg) {
      try {
        pushEvent(JSON.parse(String(msg.data)) as pki.CertEvent);
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
    pushEvent({ type: "failed", status: e.status, message: e.message });
  } else {
    pushEvent({
      type: "failed",
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
      Accept: "text/event-stream",
      Authorization: `Bearer ${selectedClient.value.token}`,
    },
    body: JSON.stringify({ domains: parsedDomains.value }),
  });
}

const showClientSelector = !props.client;

function cancel() {
  close();
}
</script>

<template>
  <div class="w-[560px] max-h-[80vh] flex flex-col gap-4">
    <h2 class="text-lg font-semibold">请求证书</h2>

    <div class="flex flex-col gap-3">
      <div v-if="showClientSelector" class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">消费方</label>
        <Select v-model="selectedClientId" :disabled="running">
          <SelectTrigger>
            <SelectValue placeholder="选择消费方" />
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
          :disabled="!selectedClient || !parsedDomains.length"
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
          'text-destructive': e.type === 'failed',
          'text-green-600': e.type === 'completed',
        }"
      >
        <template v-if="e.type === 'started'">
          ▶ 开始处理
          <Badge variant="secondary">{{ e.commonName }}</Badge>
          <template v-if="e.sans.length > 1">
            <Badge v-for="d in e.sans" :key="d" variant="secondary">{{
              d
            }}</Badge>
          </template>
        </template>
        <template v-else-if="e.type === 'decision'">
          {{ e.mode === "reuse" ? "💾" : e.mode === "renew" ? "🔄" : "🆕" }}
          {{
            e.mode === "reuse"
              ? "缓存复用"
              : e.mode === "renew"
                ? "续期"
                : "新签"
          }}
          — {{ e.reason }}
        </template>
        <template v-else-if="e.type === 'challenge'">
          {{
            e.status === "preparing" ? "⏳" : e.status === "ready" ? "✓" : "🗑️"
          }}
          DNS 挑战
          <Badge variant="secondary">{{ e.domain }}</Badge>
          {{
            e.status === "preparing"
              ? "准备中"
              : e.status === "ready"
                ? "就绪"
                : "清理中"
          }}
        </template>
        <template v-else-if="e.type === 'issued'">
          ✅ 证书签发完成
          <template v-if="e.notBefore">
            {{ new Date(e.notBefore).toLocaleDateString() }} –
          </template>
          {{ new Date(e.notAfter).toLocaleDateString() }}
        </template>
        <template v-else-if="e.type === 'completed'">
          ✅ 完成！有效期至
          {{ new Date(e.result.notAfter).toLocaleDateString() }}
        </template>
        <template v-else-if="e.type === 'failed'">
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
