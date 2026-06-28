<script setup lang="ts">
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import AcmeAccountEditor from "./AcmeAccountEditor.vue";
import Button from "@/components/ui/button/Button.vue";
import { useConfirmPopover, useFormModel } from "@/components/acrux-ui/actions";
import { CopyBtn, DateFormatter } from "@/components/acrux-ui/display";
import { SquarePen, Trash2 } from "@lucide/vue";
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

const { useAll, useRemoval } = useAcmeAccountStore();
const [items] = useAll();
const { update } = useFormModel(AcmeAccountEditor);
const router = useRouter();

const removal = useConfirmPopover({
  message: "确定删除该 ACME 账户？引用它的客户端与证书会解除关联。",
  useRemoval,
});
</script>

<template>
  <div v-if="items.length > 0">
    <removal.ConfirmPopover />
    <Table>
      <TableCaption>共 {{ items.length }} 个账户</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>邮箱</TableHead>
          <TableHead>目录 URL</TableHead>
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
          @click="router.push(`/acme-accounts/${row.id}`)"
        >
          <TableCell>{{ row.name || "(未命名)" }}</TableCell>
          <TableCell class="text-zinc-400">{{ row.email || "—" }}</TableCell>
          <TableCell class="max-w-[260px] truncate text-zinc-500">{{
            row.acmeUrl || "—"
          }}</TableCell>
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
