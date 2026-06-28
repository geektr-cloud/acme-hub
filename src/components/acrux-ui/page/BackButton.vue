<script setup lang="ts">
import Button from "@/components/ui/button/Button.vue";
import { ArrowLeft } from "@lucide/vue";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const canGoBack = ref(false);
onMounted(() => (canGoBack.value = !!window.history.state?.back));
</script>

<template>
  <Button v-bind="$attrs" variant="ghost" :disabled="!canGoBack" @click="router.back()">
    <ArrowLeft />
    <slot>返回</slot>
  </Button>
</template>
