<script setup lang="ts">
import { ref, watch } from "vue";
import { Textarea } from "@/components/ui/textarea";

const props = defineProps<{
  // Any valid JSON value — object, array, string, number, boolean, or null.
  modelValue?: unknown;
  disabled?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  "update:invalid": [invalid: boolean];
}>();

const text = ref(JSON.stringify(props.modelValue ?? null, null, 2));

watch(
  () => props.modelValue,
  (val) => {
    // Skip if our current text already represents this value (user is mid-edit)
    try {
      if (JSON.stringify(JSON.parse(text.value)) === JSON.stringify(val))
        return;
    } catch {
      // text is currently invalid — always sync
    }
    text.value = JSON.stringify(val ?? null, null, 2);
    emit("update:invalid", false);
  },
);

const onInput = (e: Event) => {
  const raw = (e.target as HTMLTextAreaElement).value;
  text.value = raw;
  try {
    emit("update:modelValue", JSON.parse(raw) as unknown);
    emit("update:invalid", false);
  } catch {
    // Keep the last valid value upstream; just flag the draft as unparseable.
    emit("update:invalid", true);
  }
};
</script>

<template>
  <Textarea
    :value="text"
    :disabled="disabled"
    :class="['font-mono text-xs', props.class]"
    spellcheck="false"
    @input="onInput"
  />
</template>
