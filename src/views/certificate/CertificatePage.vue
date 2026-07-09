<script setup lang="ts">
import { defineComponent, h, nextTick, onUnmounted } from "vue";
import { VueFinalModal, useModal } from "vue-final-modal";
import { useCertificateStore } from "@/stores/certificates";
import CertificateList from "./CertificateList.vue";
import RequestCertModal from "./RequestCertModal.vue";
import { PageEntry } from "@/components/acrux-ui/page";
import { Card, CardContent } from "@/components/ui/card";

const { useAll } = useCertificateStore();
const [items, status, refresh] = useAll();

const { open, close, destroy } = useModal({
  component: defineComponent({
    setup() {
      return () =>
        h(
          VueFinalModal,
          {
            class: "flex overflow-y-auto py-[10vh]",
            contentClass: "m-auto flex flex-col max-w-5xl px-4",
            focusTrap: false,
            zIndexFn: ({ index }) => 50 + index,
          },
          {
            default: () =>
              h(Card, null, {
                default: () =>
                  h(CardContent, null, {
                    default: () => h(RequestCertModal, { onClose: close }),
                  }),
              }),
          },
        );
    },
  }),
});

onUnmounted(destroy);

function onCreate() {
  close();
  nextTick(() => open());
}
</script>

<template>
  <PageEntry
    title="证书"
    description="签发流程生成的证书（只读）"
    :loading="status.loading"
    :error="status.error"
    :items="items"
    @retry="void refresh()"
    @create="onCreate()"
  >
    <CertificateList />
  </PageEntry>
</template>
