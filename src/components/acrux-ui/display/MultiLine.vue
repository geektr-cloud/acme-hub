<script setup lang="ts">
import { Minus } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  value?: string | null;
}>();

const lines = computed(() => props.value?.split("\n") ?? []);
</script>

<template>
  <div class="flex flex-col gap-1">
    <p v-for="line in lines" :key="line">{{ line }}</p>
    <Minus v-if="!props.value" />
  </div>
</template>
