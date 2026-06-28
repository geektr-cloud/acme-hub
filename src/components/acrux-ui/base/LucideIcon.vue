<script setup lang="ts">
import type { Component } from "vue";

const props = withDefaults(
  defineProps<{
    as: Component;
    size?: "xs" | "sm" | "md" | "lg";
  }>(),
  { size: "sm" },
);

const sizeClass = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
}[props.size];
</script>

<template>
  <component :is="as" :class="[sizeClass, 'shrink-0']" />
</template>
