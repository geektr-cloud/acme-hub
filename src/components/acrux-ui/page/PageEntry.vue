<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { computed, useSlots } from "vue";
import { File, FileX, Plus, RotateCcw } from "@lucide/vue";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const props = defineProps<{
  title: string;
  description?: string;
  loading?: boolean;
  error?: unknown;
  items?: unknown[] | null;
}>();

defineEmits<{ (e: "retry"): void; (e: "create"): void }>();

const slots = useSlots();
const errorMessage = computed(() =>
  props.error instanceof Error
    ? props.error.message
    : String(props.error ?? ""),
);
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ title }}
        </h1>
        <p class="mt-1 text-sm text-zinc-500" v-if="description">
          {{ description }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <slot name="actions"></slot>
        <div
          v-if="slots.actions"
          class="bg-border mx-1 h-6 w-px"
          aria-hidden="true"
        ></div>
        <Button variant="secondary" aria-label="刷新" @click="$emit('retry')">
          <Spinner v-if="loading" />
          <RotateCcw v-else />
        </Button>
        <Button type="primary" aria-label="新建" @click="$emit('create')">
          <Plus />
        </Button>
      </div>
    </header>
    <Table v-if="loading">
      <TableHeader>
        <TableRow>
          <TableHead v-for="i in 4" :key="i">
            <Skeleton class="h-4 w-24" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="i in 4" :key="i">
          <TableCell v-for="j in 4" :key="j">
            <Skeleton class="h-4 w-36" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <Empty v-if="!loading && error" class="py-24 text-ring">
      <EmptyHeader>
        <EmptyMedia>
          <FileX class="size-10" />
        </EmptyMedia>
        <EmptyTitle>获取失败</EmptyTitle>
        <EmptyDescription v-show="errorMessage">
          <p class="text-sm text-red-500/90">{{ errorMessage }}</p>
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="secondary" @click="$emit('retry')">
          <RotateCcw />重试
        </Button>
      </EmptyContent>
    </Empty>
    <Empty v-if="!loading && items?.length === 0" class="py-24 text-ring">
      <EmptyHeader>
        <EmptyMedia>
          <File class="size-10" />
        </EmptyMedia>
        <EmptyTitle>暂无数据</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="secondary" @click="$emit('create')">
          <Plus />新建
        </Button>
      </EmptyContent>
    </Empty>
    <slot />
  </main>
</template>
