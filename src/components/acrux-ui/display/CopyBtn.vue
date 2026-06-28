<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { useClipboard } from "@vueuse/core";
import { Check, Copy } from "@lucide/vue";

const { copy, copied } = useClipboard();
defineProps<{ value: string }>();
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    class="size-3.5 cursor-pointer"
    @click="copy(value)"
    :disabled="!value"
  >
    <Copy class="size-3.5 shrink-0" v-if="!copied" />
    <Check class="size-3.5 shrink-0" v-else />
  </Button>
</template>
