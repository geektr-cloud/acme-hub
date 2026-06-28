<script setup lang="ts">
import { useCertificateStore } from "@/stores/certificates";
import Button from "@/components/ui/button/Button.vue";
import { useConfirmPopover } from "@/components/acrux-ui/actions";
import { CopyBtn, DateFormatter } from "@/components/acrux-ui/display";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "@lucide/vue";
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

const { useAll, useRemoval } = useCertificateStore();
const [items] = useAll();
const router = useRouter();

const removal = useConfirmPopover({
  message: "确定删除该证书？不可恢复。",
  useRemoval,
});
</script>

<template>
  <div v-if="items.length > 0">
    <removal.ConfirmPopover />
    <Table>
      <TableCaption>共 {{ items.length }} 张证书</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>主域名</TableHead>
          <TableHead>SAN</TableHead>
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
          @click="router.push(`/certificates/${row.id}`)"
        >
          <TableCell class="font-mono">{{ row.domain || "(无)" }}</TableCell>
          <TableCell>
            <span v-if="row.alt.length" class="inline-flex flex-wrap gap-1">
              <Badge v-for="d in row.alt" :key="d" variant="outline">{{
                d
              }}</Badge>
            </span>
            <span v-else class="text-zinc-500">—</span>
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
