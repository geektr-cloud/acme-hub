<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts" generic="T, V extends AcceptableValue = any">
import { computed, type HTMLAttributes } from "vue";
import { X } from "@lucide/vue";
import type { AcceptableValue } from "reka-ui";
import type { AsyncStatus } from "@acrux/core";
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const props = withDefaults(
  defineProps<{
    modelValue: V | null;
    items: T[];
    status?: AsyncStatus;
    preFilterFn?: (item: T) => boolean;
    transformFn?: (item: T) => { value: V; label: string };
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    status: () => ({ loading: false, error: null }),
    preFilterFn: undefined,
    transformFn: undefined,
    placeholder: "请选择",
    disabled: false,
    clearable: false,
    class: undefined,
  },
);
const emit = defineEmits<{ "update:modelValue": [value: V | null] }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultTransform = (item: any) => ({ value: item.value, label: String(item.label) });
const transform = props.transformFn ?? defaultTransform;

const options = computed(() => {
  let list = props.items;
  if (props.preFilterFn) list = list.filter(props.preFilterFn);
  return list.map(transform);
});

const selected = computed<V | null>({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const clear = () => emit("update:modelValue", null);
</script>

<template>
  <Skeleton v-if="status.loading" class="h-8 w-full" />
  <SelectRoot v-else v-model="selected" :disabled="disabled">
    <SelectTrigger :class="props.class ?? 'w-full'" class="relative">
      <SelectValue :placeholder="placeholder" />
      <button
        v-if="clearable && selected != null && !disabled"
        type="button"
        class="absolute right-8 text-muted-foreground hover:text-foreground"
        title="清除"
        @click.stop="clear"
      >
        <X class="size-4" />
      </button>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="opt in options" :key="String(opt.value)" :value="opt.value">
        {{ opt.label }}
      </SelectItem>
    </SelectContent>
  </SelectRoot>
</template>
