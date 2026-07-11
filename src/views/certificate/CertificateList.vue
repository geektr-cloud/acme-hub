<script setup lang="ts">
import { useCertificateStore } from "@/stores/certificates";
import Button from "@/components/ui/button/Button.vue";
import { useConfirmPopover } from "@/components/acrux-ui/actions";
import { DateFormatter, UUID } from "@/components/acrux-ui/display";
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
          <TableHead class="w-[140px]">ID</TableHead>
          <TableHead>通用名称</TableHead>
          <TableHead>SAN</TableHead>
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
          <TableCell @click.stop>
            <UUID :value="row.id" :copy="false" />
          </TableCell>
          <TableCell class="font-mono">{{
            row.commonName || "(无)"
          }}</TableCell>
          <TableCell>
            <Badge v-if="row.sans.length" variant="secondary">{{
              row.sans.length
            }}</Badge>
            <span v-else class="text-zinc-500">—</span>
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
