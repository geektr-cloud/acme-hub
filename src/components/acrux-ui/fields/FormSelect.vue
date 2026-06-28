<script setup lang="ts" generic="T">
import { computed } from "vue";
import { X } from "@lucide/vue";
import type { AsyncStatus } from "@acrux/core";
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    items: T[];
    status?: AsyncStatus;
    preFilterFn?: (item: T) => boolean;
    transformFn: (item: T) => { value: string; label: string };
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
  }>(),
  {
    status: () => ({ loading: false, error: null }),
    preFilterFn: undefined,
    placeholder: "请选择",
    disabled: false,
    clearable: false,
  },
);
const emit = defineEmits<{ "update:modelValue": [value: string | null] }>();

const options = computed(() => {
  let list = props.items;
  if (props.preFilterFn) list = list.filter(props.preFilterFn);
  return list.map(props.transformFn);
});

// reka-ui 不接受空串作为 item value，用 null 表示「未选择」；空串经 ?? 归一为 null。
const selected = computed<string | null>({
  get: () => props.modelValue || null,
  set: (v) => emit("update:modelValue", v || null),
});

const clear = () => emit("update:modelValue", null);
</script>

<template>
  <Skeleton v-if="status.loading" class="h-8 w-full" />
  <div v-else class="flex items-center gap-1 w-full">
    <SelectRoot v-model="selected" :disabled="disabled">
      <SelectTrigger class="flex-1">
        <SelectValue :placeholder="placeholder" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </SelectRoot>
    <button
      v-if="clearable && selected && !disabled"
      type="button"
      class="shrink-0 text-muted-foreground hover:text-foreground"
      title="清除"
      @click="clear"
    >
      <X class="size-4" />
    </button>
  </div>
</template>
