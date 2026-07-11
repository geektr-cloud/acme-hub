<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { Check, Copy, RotateCcw } from "@lucide/vue";
import { Icon, IconBtn } from "@/components/acrux-ui/base";
import { Spinner } from "@/components/ui/spinner";
import { VSeparator } from "./DataView.ts";
import { computed, ref } from "vue";

defineOptions({ name: "ApiToken" });

const { copy: doCopy, copied } = useClipboard();

const props = withDefaults(
  defineProps<{
    value: string;
    copy?: boolean;
    suffix?: number;
    prefix?: number;
    onRotate?: () => Promise<unknown>;
  }>(),
  {
    copy: true,
    suffix: 4,
    prefix: 0,
    onRotate: undefined,
  },
);

const rotating = ref(false);

const masked = computed(() => {
  const v = props.value ?? "";
  if (!v) return "";
  const head = props.prefix > 0 ? v.slice(0, props.prefix) : "";
  const tail = props.suffix > 0 ? v.slice(-props.suffix) : "";
  const hidden = v.length - head.length - tail.length;
  return head + (hidden > 0 ? "•".repeat(hidden) : "") + tail;
});

const rotate = async () => {
  if (!props.onRotate || rotating.value) return;
  rotating.value = true;
  try {
    await props.onRotate();
  } finally {
    rotating.value = false;
  }
};
</script>

<template>
  <span class="inline-flex items-center gap-1 min-w-0">
    <code class="truncate text-xs">{{ masked }}</code>
    <template v-if="(copy && value) || onRotate">
      <VSeparator />
      <IconBtn
        v-if="copy && value"
        size="icon-xs"
        class="cursor-pointer shrink-0"
        @click="doCopy(value)"
      >
        <Icon v-if="!copied" :as="Copy" />
        <Icon v-else :as="Check" />
      </IconBtn>
      <IconBtn
        v-if="onRotate"
        size="icon-xs"
        class="cursor-pointer shrink-0"
        :disabled="rotating"
        @click="rotate()"
      >
        <Spinner v-if="rotating" />
        <Icon v-else :as="RotateCcw" />
      </IconBtn>
    </template>
  </span>
</template>
