<script setup lang="ts">
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import DnsCredentialEditor from "./DnsCredentialEditor.vue";
import Button from "@/components/ui/button/Button.vue";
import { useConfirmPopover, useFormModel } from "@/components/acrux-ui/actions";
import { DateFormatter, UUID } from "@/components/acrux-ui/display";
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

const { useAll, useRemoval } = useDnsCredentialStore();
const [items] = useAll();
const { update } = useFormModel(DnsCredentialEditor);
const router = useRouter();

const providerLabel = (p: string) =>
  p === "cloudflare" ? "Cloudflare" : p === "alicloud" ? "阿里云" : p;

const removal = useConfirmPopover({
  message: "确定删除该 DNS 凭据？绑定的域名将解除关联。",
  useRemoval,
});
</script>

<template>
  <div v-if="items.length > 0">
    <removal.ConfirmPopover />
    <Table>
      <TableCaption>共 {{ items.length }} 个 DNS 凭据</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[140px]">ID</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>服务商</TableHead>
          <TableHead>描述</TableHead>
          <TableHead>更新</TableHead>
          <TableHead class="w-[100px]">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="row in items"
          :key="row.id"
          class="cursor-pointer"
          @click="router.push(`/dns-credentials/${row.id}`)"
        >
          <TableCell @click.stop>
            <UUID :value="row.id" :copy="false" />
          </TableCell>
          <TableCell>{{ row.name || "(未命名)" }}</TableCell>
          <TableCell>
            <Badge variant="secondary">{{ providerLabel(row.provider) }}</Badge>
          </TableCell>
          <TableCell class="text-zinc-400">
            {{ row.description || "(无)" }}
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
