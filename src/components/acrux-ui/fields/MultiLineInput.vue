<script setup lang="ts">
import { nextTick, ref } from "vue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconBtn } from "@/components/acrux-ui/base";
import { Plus, X } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string[];
    placeholder?: string;
    addText?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: () => [],
    placeholder: "",
    addText: "添加",
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", payload: string[]): void;
}>();
const rowRefs = ref<Array<HTMLDivElement | null>>([]);

const updateValue = (next: string[]) => emit("update:modelValue", next);

const addLine = () => {
  updateValue([...props.modelValue, ""]);
};

const removeLine = (index: number) => {
  const next = [...props.modelValue];
  next.splice(index, 1);
  updateValue(next);
};

const setLine = (index: number, value: string | number) => {
  const next = [...props.modelValue];
  next[index] = String(value);
  updateValue(next);
};

const focusInput = async (index: number, moveCaretToEnd = false) => {
  await nextTick();
  const input = rowRefs.value[index]?.querySelector("input");
  if (!input) return;
  input.focus();
  if (moveCaretToEnd) {
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  }
};

const insertAfter = (index: number) => {
  const next = [...props.modelValue];
  next.splice(index + 1, 0, "");
  updateValue(next);
  void focusInput(index + 1);
};

const onBackspace = (index: number, event: KeyboardEvent) => {
  const target = event.target as HTMLInputElement | null;
  if (!target || target.value.length > 0 || index <= 0) return;
  event.preventDefault();
  const next = [...props.modelValue];
  next.splice(index, 1);
  updateValue(next);
  void focusInput(index - 1, true);
};
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(_, index) in modelValue"
      :key="index"
      :ref="(el) => (rowRefs[index] = el as HTMLDivElement | null)"
      class="flex items-center gap-2"
    >
      <Input
        :model-value="modelValue[index]"
        :placeholder="placeholder"
        :disabled="disabled"
        class="flex-1"
        @update:model-value="(value) => setLine(index, value)"
        @keydown.enter.prevent="insertAfter(index)"
        @keydown.backspace="onBackspace(index, $event)"
      />
      <IconBtn
        :as="X"
        class="text-destructive hover:text-destructive"
        :disabled="disabled"
        @click="removeLine(index)"
      />
    </div>

    <Button type="button" variant="outline" size="sm" class="w-fit" :disabled="disabled" @click="addLine">
      <Plus class="size-4" />
      {{ addText }}
    </Button>
  </div>
</template>
