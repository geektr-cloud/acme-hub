import { defineComponent, h } from "vue";
import { Separator } from "@/components/ui/separator";

export const DataView = defineComponent({
  name: "DataView",
  setup(_, { slots }) {
    return () => h("dl", { class: "divide-y divide-zinc-800" }, slots.default?.());
  },
});

export const DataItem = defineComponent({
  name: "DataItem",
  props: {
    label: { type: String, required: false, default: "" },
  },
  setup(props, { slots }) {
    return () => {
      return h("div", { class: "flex gap-2 py-2 text-sm" }, [
        h("dt", { class: "w-24 shrink-0 text-zinc-400" }, slots.label?.() ?? props.label),
        h("dd", { class: "min-w-0 flex-1 text-zinc-200 flex items-center gap-2" }, slots.default?.()),
      ]);
    };
  },
});

export const VSeparator = defineComponent({
  name: "VSeparator",
  setup() {
    return () => h(Separator, { orientation: "vertical" });
  },
});
