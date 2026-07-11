<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { Check, Copy } from "@lucide/vue";
import { Icon, IconBtn } from "@/components/acrux-ui/base";
import { VSeparator } from "./DataView.ts";

const { copy: doCopy, copied } = useClipboard();

withDefaults(
  defineProps<{
    value: string;
    copy?: boolean;
    short?: number;
  }>(),
  {
    copy: true,
    short: 12,
  },
);
</script>

<template>
  <span class="inline-flex items-center gap-1 min-w-0">
    <code class="truncate text-xs">{{ value?.slice(-short) }}</code>
    <template v-if="copy && value">
      <VSeparator />
      <IconBtn
        size="icon-xs"
        class="cursor-pointer shrink-0"
        @click="doCopy(value)"
      >
        <Icon v-if="!copied" :as="Copy" />
        <Icon v-else :as="Check" />
      </IconBtn>
    </template>
  </span>
</template>
