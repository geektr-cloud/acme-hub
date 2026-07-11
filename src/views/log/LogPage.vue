<script setup lang="ts">
import { ref, watch } from "vue";
import { useAsyncState, useHonoApi } from "@acrux/core";
import { client } from "@/utils/api";
import { PageEntry } from "@/components/acrux-ui/page";
import { DateFormatter } from "@/components/acrux-ui/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "vue-router";

const router = useRouter();
const page = ref(1);
const limit = 20;

const fetchLogs = useHonoApi(() =>
  client.api.logs.$get({ query: { page: page.value, limit } }),
);

const [data, status, reload] = useAsyncState(
  async () => {
    const result = await fetchLogs();
    return result;
  },
  null,
  { immediate: true },
);

watch(page, () => reload());

const totalPages = ref(0);
watch(data, (s) => {
  if (s) {
    totalPages.value = Math.ceil(s.total / limit);
  }
});
</script>

<template>
  <PageEntry
    title="日志"
    description="消费者操作日志"
    :loading="status.loading"
    :error="status.error"
    :items="data?.items ?? []"
    :on-retry="() => reload()"
  >
    <div v-if="data && data.items.length > 0" class="space-y-4">
      <Table>
        <TableCaption>共 {{ data.total }} 条日志</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[180px]">时间</TableHead>
            <TableHead>消费者</TableHead>
            <TableHead>事件</TableHead>
            <TableHead>描述</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="item in data.items" :key="item.id">
            <TableCell class="text-zinc-500">
              <DateFormatter :value="item.createdAt" format="distance" />
            </TableCell>
            <TableCell>
              <a
                v-if="item.consumerName"
                class="cursor-pointer text-primary hover:underline"
                @click="router.push(`/consumers/${item.consumerId}`)"
              >
                {{ item.consumerName }}
              </a>
              <span v-else class="text-zinc-500">（已删除）</span>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{{ item.event }}</Badge>
            </TableCell>
            <TableCell>{{ item.description }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          :disabled="page <= 1"
          @click="page--"
        >
          上一页
        </Button>
        <span class="text-sm text-zinc-500">
          {{ page }} / {{ totalPages }}
        </span>
        <Button
          variant="secondary"
          size="sm"
          :disabled="page >= totalPages"
          @click="page++"
        >
          下一页
        </Button>
      </div>
    </div>
  </PageEntry>
</template>
