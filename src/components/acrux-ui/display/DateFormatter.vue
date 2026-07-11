<script setup lang="ts">
import { computed } from "vue";
import { format as _format, formatDistanceToNow } from "date-fns";
import { VSeparator } from "./DataView.ts";

defineOptions({ name: "DataDate" });

const props = withDefaults(
  defineProps<{
    value: Date | string | number;
    format?: string;
    additionDistance?: boolean;
  }>(),
  {
    format: "datetime",
    additionDistance: false,
  },
);

const dateFormatPresets: Record<string, string> = {
  date: "yyyy-MM-dd",
  datetime: "yyyy-MM-dd HH:mm:ss",
  time: "HH:mm:ss",
  timestamp: "T",
};

const d = computed(() =>
  props.value instanceof Date ? props.value : new Date(props.value),
);

const dateString = computed(() => {
  if (props.format === "distance") {
    return formatDistanceToNow(d.value, { addSuffix: true });
  }
  return _format(d.value, dateFormatPresets[props.format] ?? props.format);
});

const distance = computed(() =>
  formatDistanceToNow(d.value, { addSuffix: true }),
);
</script>

<template>
  <template v-if="additionDistance">
    <span>{{ dateString }}</span>
    <VSeparator />
    <span class="text-zinc-500">{{ distance }}</span>
  </template>
  <span v-else>{{ dateString }}</span>
</template>
