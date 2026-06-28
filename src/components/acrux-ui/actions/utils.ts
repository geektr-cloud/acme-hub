import type { Component } from "vue";
import { defineComponent, h, nextTick, onUnmounted, ref } from "vue";
import { VueFinalModal, useModal } from "vue-final-modal";
import { Card, CardContent } from "@/components/ui/card";

export const useFormModel = (Form: Component) => {
  const id = ref<string>();

  const component = defineComponent({
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
                    default: () =>
                      h(Form, {
                        id: id.value,
                        onClose: close,
                      }),
                  }),
              }),
          },
        );
    },
  });

  const { open, close, destroy } = useModal({ component });

  onUnmounted(destroy);

  const create = () => {
    close();
    nextTick(() => {
      id.value = undefined;
      open();
    });
  };

  const update = (_id: string) => {
    close();
    nextTick(() => {
      id.value = _id;
      open();
    });
  };

  return { create, update };
};
