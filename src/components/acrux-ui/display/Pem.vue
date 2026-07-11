<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { Check, Copy, Download, Eye, EyeClosed, Minus } from "@lucide/vue";
import { Icon, IconBtn } from "@/components/acrux-ui/base";
import { ref, watch } from "vue";
import { pemFingerprints, type PemEncode } from "./pem";
import { VSeparator } from "./DataView.ts";

defineOptions({ name: "PemDisplay" });

const { copy: doCopy, copied } = useClipboard();

const props = withDefaults(
  defineProps<{
    value?: string | null;
    expand?: boolean;
    copy?: boolean;
    download?: string;
    encode?: PemEncode;
  }>(),
  {
    value: undefined,
    expand: false,
    copy: false,
    download: "",
    encode: "base64",
  },
);

const visible = ref(props.expand);
watch(
  () => props.expand,
  (v) => (visible.value = v),
);

const hashes = ref<{ label: string; fingerprint: string }[]>([]);

watch(
  [() => props.value, () => props.encode],
  async ([v, e]) => {
    hashes.value = v ? await pemFingerprints(v, e) : [];
  },
  { immediate: true },
);

const downloadFile = () => {
  if (!props.download || !props.value) return;
  const blob = new Blob([props.value], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = props.download;
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div v-if="value" class="flex flex-col gap-1 min-w-0">
    <div class="inline-flex items-center gap-1 min-w-0">
      <div class="flex flex-col min-w-0">
        <code v-for="(h, i) in hashes" :key="i" class="truncate text-xs">
          SHA256:{{ h.fingerprint }}
        </code>
      </div>
      <VSeparator />
      <IconBtn
        v-if="copy"
        size="icon-xs"
        class="cursor-pointer shrink-0"
        @click="doCopy(value)"
      >
        <Icon v-if="!copied" :as="Copy" />
        <Icon v-else :as="Check" />
      </IconBtn>
      <IconBtn
        v-if="download"
        size="icon-xs"
        class="cursor-pointer shrink-0"
        @click="downloadFile()"
      >
        <Icon :as="Download" />
      </IconBtn>
      <IconBtn
        size="icon-xs"
        class="cursor-pointer shrink-0"
        @click="visible = !visible"
      >
        <Icon v-if="visible" :as="Eye" />
        <Icon v-else :as="EyeClosed" />
      </IconBtn>
    </div>
    <pre
      v-if="visible"
      class="bg-muted overflow-x-auto rounded border p-2 text-xs"
    ><code>{{ value }}</code></pre>
  </div>
  <span v-else class="text-zinc-500"><Icon :as="Minus" /></span>
</template>
