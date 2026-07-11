<script setup lang="ts">
import { Badge, type BadgeVariants } from "@/components/ui/badge";
import { useClipboard } from "@vueuse/core";
import { Check, Copy } from "@lucide/vue";
import { Icon } from "@/components/acrux-ui/base";
import { VSeparator } from "./DataView.ts";
const { copy, copied } = useClipboard();

const props = withDefaults(
  defineProps<{
    label?: string;
    value?: string;
    variant?: BadgeVariants["variant"] | "raw";
  }>(),
  {
    label: undefined,
    value: undefined,
    variant: "raw",
  },
);

const WrapTag = props.variant === "raw" ? "p" : Badge;
</script>

<template>
  <WrapTag v-bind="$attrs" class="max-w-full flex items-center gap-2 cursor-pointer" @click="value && copy(value)">
    <code class="inline-block truncate min-w-0">{{ label ?? value }}</code>
    <template v-if="label || value">
      <VSeparator />
      <Icon v-if="!copied" :as="Copy" />
      <Icon v-else :as="Check" />
    </template>
  </WrapTag>
</template>
