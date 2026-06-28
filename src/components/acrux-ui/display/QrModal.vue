<script setup lang="ts">
import { ref, onMounted } from "vue";
import { VueFinalModal } from "vue-final-modal";
import QRCode from "qrcode";
import { Card, CardContent } from "@/components/ui/card";

const props = defineProps<{ value: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const svg = ref("");
const error = ref("");

onMounted(async () => {
  try {
    svg.value = await QRCode.toString(props.value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "生成失败";
  }
});
</script>

<template>
  <VueFinalModal
    class="flex items-center justify-center"
    content-class="outline-none"
    :focus-trap="false"
    @click-outside="emit('close')"
  >
    <Card class="cursor-pointer" @click="emit('close')">
      <CardContent class="flex flex-col items-center gap-2 p-4">
        <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
        <div v-else-if="!svg" class="text-muted-foreground text-sm">生成中...</div>
        <div v-else v-html="svg" class="bg-white p-2 rounded [&>svg]:block [&>svg]:w-64 [&>svg]:h-64" />
        <p class="text-xs font-mono break-all max-w-[256px] text-muted-foreground">{{ value }}</p>
      </CardContent>
    </Card>
  </VueFinalModal>
</template>
