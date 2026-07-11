<script setup lang="ts">
import { Icon, IconBtn } from "@/components/acrux-ui/base";
import { useClipboard } from "@vueuse/core";
import { Check, Copy } from "@lucide/vue";

const { copy, copied } = useClipboard();
defineProps<{ value: string }>();
</script>

<template>
  <IconBtn
    size="icon-xs"
    class="cursor-pointer"
    :disabled="!value"
    @click="copy(value)"
  >
    <Icon v-if="!copied" :as="Copy" />
    <Icon v-else :as="Check" />
  </IconBtn>
</template>
