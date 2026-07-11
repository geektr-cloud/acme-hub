<script setup lang="ts">
import { BackButton } from "@/components/acrux-ui/page";
import { DataItem, DataView } from "@/components/acrux-ui/display";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { computed } from "vue";
import { FileX, RotateCcw } from "@lucide/vue";
import Button from "@/components/ui/button/Button.vue";

const props = defineProps<{
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}>();

const errorMessage = computed(() => (props.error instanceof Error ? props.error.message : String(props.error ?? "")));
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-4">
    <header>
      <BackButton />
    </header>
    <Card v-if="loading">
      <CardHeader>
        <CardTitle>
          <Skeleton class="w-24 h-4" />
        </CardTitle>
        <CardAction>
          <Skeleton class="w-48 h-8" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataView>
          <DataItem v-for="i in 5" :key="i">
            <template #label>
              <Skeleton class="w-24 h-4" />
            </template>
            <template #default>
              <Skeleton class="w-full h-4" />
            </template>
          </DataItem>
        </DataView>
      </CardContent>
    </Card>
    <Card v-if="!loading && error">
      <CardContent>
        <Empty class="py-24 text-ring">
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
            <Button v-if="onRetry" variant="secondary" @click="onRetry()"> <RotateCcw />重试 </Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
    <slot />
  </main>
</template>
