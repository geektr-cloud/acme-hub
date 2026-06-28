<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useModal } from "vue-final-modal";
import { QrCode } from "@lucide/vue";
import { Button } from "@/components/ui/button";

withDefaults(
  defineProps<{ value: string; small?: boolean; title?: string }>(),
  {
    small: false,
    title: "二维码",
  },
);

// Lazy chunk: QR encoder + modal markup don't ship in the main bundle.
const QrModal = defineAsyncComponent(() => import("./QrModal.vue"));

const onClick = (value: string) => {
  const handler = useModal({
    component: QrModal,
    attrs: { value, onClose: () => handler.close() },
  });
  handler.open();
};
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :class="small ? 'size-3.5 cursor-pointer' : 'cursor-pointer'"
    :disabled="!value"
    :title="title"
    @click="onClick(value)"
  >
    <QrCode :class="small ? 'size-3.5 shrink-0' : ''" />
  </Button>
</template>
