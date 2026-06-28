<script setup lang="ts">
import type { Component } from "vue";
import { Button, type ButtonVariants } from "@/components/ui/button";
import Icon from "./LucideIcon.vue";

defineProps<{
  as?: Component;
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  asChild?: boolean;
}>();
</script>

<template>
  <Button
    :variant="variant ?? 'ghost'"
    :size="size ?? 'icon'"
    :disabled="disabled"
    :title="title"
    :aria-label="ariaLabel"
    :as-child="asChild"
  >
    <slot>
      <Icon v-if="as" :as="as" />
    </slot>
  </Button>
</template>
