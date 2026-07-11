<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { Check, Copy, Download, Eye, EyeClosed } from "@lucide/vue";
import { Icon, IconBtn } from "@/components/acrux-ui/base";
import { ref, watch } from "vue";
import { pemFingerprint, type PemEncode } from "./pem";

defineOptions({ name: "PemDisplay" });

const { copy: doCopy, copied } = useClipboard();

const props = withDefaults(
  defineProps<{
    value: string;
    expand?: boolean;
    copy?: boolean;
    download?: string;
    encode?: PemEncode;
  }>(),
  {
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

const sha256 = ref("");

watch(
  [() => props.value, () => props.encode],
  async ([v, e]) => {
    sha256.value = await pemFingerprint(v, e);
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
  <div class="flex flex-col gap-1 min-w-0">
    <div class="inline-flex items-center gap-1 min-w-0">
      <code class="truncate text-xs">SHA256:{{ sha256 }}</code>
      <IconBtn v-if="copy && value" size="icon-xs" class="cursor-pointer shrink-0" @click="doCopy(value)">
        <Icon v-if="!copied" :as="Copy" />
        <Icon v-else :as="Check" />
      </IconBtn>
      <IconBtn v-if="download && value" size="icon-xs" class="cursor-pointer shrink-0" @click="downloadFile()">
        <Icon :as="Download" />
      </IconBtn>
      <IconBtn size="icon-xs" class="cursor-pointer shrink-0" @click="visible = !visible">
        <Icon v-if="visible" :as="Eye" />
        <Icon v-else :as="EyeClosed" />
      </IconBtn>
    </div>
    <pre
      v-if="visible && value"
      class="bg-muted overflow-x-auto rounded border p-2 text-xs"
    ><code>{{ value }}</code></pre>
  </div>
</template>
