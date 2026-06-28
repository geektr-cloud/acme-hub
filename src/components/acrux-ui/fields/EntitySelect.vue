<script setup lang="ts" generic="T">
import { computed, ref } from "vue";
import { Check, Pencil, SquareCheck, Trash2 } from "@lucide/vue";
import { Icon } from "@/components/acrux-ui/base";
import type { AsyncStatus } from "@acrux/core";
import { Input } from "@/components/ui/input";
import { IconBtn } from "@/components/acrux-ui/base";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    items: T[];
    status?: AsyncStatus;
    preFilterFn?: (item: T) => boolean;
    transformFn: (item: T) => { id: string; searchText: string; title: string; summary?: string };
    placeholder?: string;
    editable?: boolean;
  }>(),
  {
    preFilterFn: undefined,
    status: () => ({ loading: false, error: null }),
    placeholder: "未选择",
    editable: true,
  },
);
const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();

const search = ref("");
const open = ref(false);

const transformed = computed(() => {
  let list = props.items;
  if (props.preFilterFn) list = list.filter(props.preFilterFn);
  return list.map(props.transformFn);
});

const filtered = computed(() => {
  const term = search.value.toLowerCase();
  if (!term) return transformed.value;
  return transformed.value.filter((t) => t.searchText.toLowerCase().includes(term));
});

const knownIds = computed(() => new Set(transformed.value.map((t) => t.id)));
const staleIds = computed(() => props.modelValue.filter((id) => !knownIds.value.has(id)));
const cleanupStale = () =>
  emit(
    "update:modelValue",
    props.modelValue.filter((id) => knownIds.value.has(id)),
  );

const selectedLabels = computed(() =>
  props.modelValue.map((id) => transformed.value.find((t) => t.id === id)?.title ?? id.slice(0, 8)),
);

const toggle = (id: string) => {
  const set = new Set(props.modelValue);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  emit("update:modelValue", [...set]);
};

const selectAll = () => {
  emit(
    "update:modelValue",
    filtered.value.map((t) => t.id),
  );
};
</script>

<template>
  <div class="flex-1 min-w-0">
    <Skeleton v-if="status.loading" class="h-6 w-full" />
    <div v-else-if="!editable" class="flex flex-wrap items-center gap-1 w-full max-h-[3.25rem] overflow-y-auto">
      <template v-if="selectedLabels.length">
        <span
          v-for="(label, i) in selectedLabels"
          :key="i"
          class="bg-zinc-700 text-xs px-1.5 py-0.5 rounded truncate max-w-full"
          >{{ label }}</span
        >
      </template>
      <span v-else class="text-xs text-muted-foreground">{{ placeholder ?? "未选择" }}</span>
    </div>
    <Popover v-else v-model:open="open">
      <PopoverTrigger as-child>
        <button class="flex flex-wrap items-center gap-1 w-full text-left max-h-[3.25rem] overflow-y-auto">
          <template v-if="selectedLabels.length">
            <span
              v-for="(label, i) in selectedLabels"
              :key="i"
              class="bg-zinc-700 text-xs px-1.5 py-0.5 rounded truncate max-w-full"
              >{{ label }}</span
            >
          </template>
          <span v-else class="text-xs text-muted-foreground">{{ placeholder ?? "未选择" }}</span>
          <Icon :as="Pencil" size="xs" class="text-muted-foreground" />
          <span
            v-if="staleIds.length"
            role="button"
            class="ml-1 inline-flex items-center gap-0.5 text-xs text-destructive hover:underline shrink-0"
            title="清理失效项"
            @click.stop="cleanupStale"
          >
            <Icon :as="Trash2" size="xs" />
            清理失效项
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" class="w-80 max-h-80 flex flex-col">
        <div class="flex items-center gap-1">
          <Input v-model="search" class="h-6 text-xs flex-1" placeholder="搜索..." />
          <IconBtn :as="SquareCheck" size="icon-xs" class="shrink-0" title="全选" @click="selectAll" />
        </div>
        <div class="overflow-y-auto flex-1 -mx-1">
          <button
            v-for="item in filtered"
            :key="item.id"
            class="flex items-start gap-2 w-full px-1 py-1 rounded hover:bg-accent text-left"
            @click="toggle(item.id)"
          >
            <div class="mt-0.5 size-3.5 shrink-0 rounded border border-input flex items-center justify-center">
              <Check v-if="modelValue.includes(item.id)" class="size-2.5" />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-xs truncate">{{ item.title }}</span>
              <span class="text-xs text-muted-foreground truncate">{{ item.summary }}</span>
            </div>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
