<script setup lang="ts">
import { computed } from "vue";
import { useDomainStore } from "@/stores/domains";
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import DomainEditor from "./DomainEditor.vue";
import Button from "@/components/ui/button/Button.vue";
import { useConfirmPopover, useFormModel } from "@/components/acrux-ui/actions";
import { CopyBtn, DateFormatter } from "@/components/acrux-ui/display";
import { Badge } from "@/components/ui/badge";
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

const { useAll, useRemoval } = useDomainStore();
const [items] = useAll();
const { update } = useFormModel(DomainEditor);
const router = useRouter();

const { useAll: useAllCredentials } = useDnsCredentialStore();
const [credentials] = useAllCredentials();
const credentialName = computed(() => (id: string | null) => {
  if (!id) return null;
  return credentials.value.find((c) => c.id === id)?.name ?? "未知凭据";
});

const removal = useConfirmPopover({
  message: "确定删除该域名？",
  useRemoval,
});
</script>

<template>
  <div v-if="items.length > 0">
    <removal.ConfirmPopover />
    <Table>
      <TableCaption>共 {{ items.length }} 个域名</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>域名</TableHead>
          <TableHead>DNS 凭据</TableHead>
          <TableHead>描述</TableHead>
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
          @click="router.push(`/domains/${row.id}`)"
        >
          <TableCell class="font-mono text-sm">{{
            row.name || "(未命名)"
          }}</TableCell>
          <TableCell>
            <Badge
              v-if="credentialName(row.dnsCredentialId)"
              variant="secondary"
            >
              {{ credentialName(row.dnsCredentialId) }}
            </Badge>
            <span v-else class="text-zinc-500">未绑定</span>
          </TableCell>
          <TableCell class="text-zinc-400">
            {{ row.description || "(无)" }}
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
