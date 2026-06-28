import type { ReferenceElement } from "reka-ui";
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import _ConfirmPopover from "./ConfirmPopover.vue";
import type { BaseData, BaseId, UseRemoval } from "@acrux/core";

export { useFormModel } from "./utils";
export { default as RemovalButton } from "./RemovalButton.vue";
export { default as ConfirmPopover } from "./ConfirmPopover.vue";

export interface ConfirmPopoverOptions<T extends BaseData> {
  message: string | ((src: T | undefined) => string);
  useRemoval: UseRemoval<T>;
}

export const useConfirmPopover = <T extends BaseData>(
  opts: ConfirmPopoverOptions<T>,
) => {
  const id = ref<BaseId | undefined>();
  const anchor = ref<ReferenceElement>();
  const isOpen = ref(false);

  const ConfirmPopover = defineComponent({
    setup() {
      const removal = opts.useRemoval(id);
      const message = computed(() =>
        typeof opts.message === "function"
          ? opts.message(removal[2][0].value)
          : opts.message,
      );

      return () =>
        h(_ConfirmPopover, {
          anchor: anchor.value,
          message: message.value,
          ctx: removal,
          open: isOpen.value,
          "onUpdate:open": (v: boolean) => (isOpen.value = v),
        });
    },
  });

  const open = (event: Event, _id: BaseId) => {
    anchor.value = event.target as ReferenceElement;
    id.value = _id;
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
    anchor.value = undefined;
    id.value = undefined;
  };

  const onGlobalClick = (event: Event) => {
    if (
      anchor.value &&
      anchor.value instanceof Node &&
      anchor.value.contains(event.target as Node)
    )
      return;
    close();
  };

  onMounted(() => window.addEventListener("click", onGlobalClick));
  onUnmounted(() => window.removeEventListener("click", onGlobalClick));

  return { open, close, ConfirmPopover };
};
