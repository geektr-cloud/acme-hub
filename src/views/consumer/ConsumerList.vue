<script setup lang="ts">
import { useConsumerStore } from "@/stores/consumers";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import ConsumerEditor from "./ConsumerEditor.vue";
import Button from "@/components/ui/button/Button.vue";
import { useConfirmPopover, useFormModel } from "@/components/acrux-ui/actions";
import { CopyBtn, DateFormatter } from "@/components/acrux-ui/display";
import { Badge } from "@/components/ui/badge";
import { SquarePen, Trash2 } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const { useAll, useRemoval } = useConsumerStore();
const [items] = useAll();
const { update } = useFormModel(ConsumerEditor);
const router = useRouter();

const { useAll: useAllAccounts } = useAcmeAccountStore();
const [accounts] = useAllAccounts();
const accountName = computed(() => (id: string | null) => {
  if (!id) return null;
  return accounts.value.find((a) => a.id === id)?.name ?? "未知账户";
});

const removal = useConfirmPopover({
  message: "确定删除该消费方？",
  useRemoval,
});
</script>

<template>
  <div v-if="items.length > 0">
    <removal.ConfirmPopover />
    <Table>
      <TableCaption>共 {{ items.length }} 个消费方</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>规则数</TableHead>
          <TableHead>绑定账户</TableHead>
          <TableHead>ID</TableHead>
          <TableHead>更新</TableHead>
          <TableHead class="w-[100px]">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="row in items"
          :key="row.id"
          class="cursor-pointer"
          @click="router.push(`/consumers/${row.id}`)"
        >
          <TableCell>{{ row.name || "(未命名)" }}</TableCell>
          <TableCell class="text-zinc-400">{{ row.allow.length }}</TableCell>
          <TableCell>
            <Badge v-if="accountName(row.acmeAccountId)" variant="secondary">{{
              accountName(row.acmeAccountId)
            }}</Badge>
            <span v-else class="text-zinc-500">未绑定</span>
          </TableCell>
          <TableCell class="text-zinc-500">
            <span class="inline-flex items-center gap-1" @click.stop>
              {{ row.id.slice(0, 8) }}
              <CopyBtn :value="row.id" />
            </span>
          </TableCell>
          <TableCell class="text-zinc-500">
            <DateFormatter :value="row.updatedAt" format="distance" />
          </TableCell>
          <TableCell @click.stop>
            <Button variant="ghost" size="icon" @click="update(row.id)">
              <SquarePen />
            </Button>
            <Button
              variant="ghost"
              class="text-destructive hover:text-destructive"
              size="icon"
              @click="(e: MouseEvent) => removal.open(e, row.id)"
            >
              <Trash2 />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
