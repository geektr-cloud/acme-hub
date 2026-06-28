<script setup lang="ts">
import { computed } from "vue";
import { format as _format, formatDistanceToNow } from "date-fns";

defineOptions({ name: "DataDate" });

const props = withDefaults(
  defineProps<{
    value: Date | string | number;
    format?: string;
  }>(),
  {
    format: "datetime",
  },
);

const dateFormatPresets: Record<string, string> = {
  date: "yyyy-MM-dd",
  datetime: "yyyy-MM-dd HH:mm:ss",
  time: "HH:mm:ss",
  timestamp: "T",
};

const dateString = computed(() => {
  const d = props.value instanceof Date ? props.value : new Date(props.value);

  if (props.format === "distance") {
    return formatDistanceToNow(d, { addSuffix: true });
  }

  return _format(d, dateFormatPresets[props.format] ?? props.format);
});
</script>

<template>
  <span>{{ dateString }}</span>
</template>
