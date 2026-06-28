<script setup lang="ts">
import Button from "@/components/ui/button/Button.vue";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { PopoverPortal, type ReferenceElement } from "reka-ui";
import { Check, X } from "@lucide/vue";
import type { Removal } from "@acrux/core";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  anchor?: ReferenceElement;
  message: string;
  ctx: Removal<unknown>;
}>();

const [status, _remove] = props.ctx;

const submit = () =>
  void _remove()
    .then(() => (open.value = false))
    .catch(() => {});
</script>

<template>
  <Popover :open="open">
    <PopoverAnchor :reference="anchor" />
    <PopoverPortal>
      <PopoverContent side="left" class="w-auto">
        <div class="flex flex-row items-center gap-2">
          <div>{{ message }}</div>
          <Button
            variant="secondary"
            size="icon"
            :disabled="status.loading"
            @click="void submit()"
          >
            <Check v-if="!status.loading" />
            <Spinner v-else />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            v-show="!status.loading"
            @click="open = false"
          >
            <X />
          </Button>
        </div>
        <p v-if="status.error" class="text-red-500">{{ status.error }}</p>
      </PopoverContent>
    </PopoverPortal>
  </Popover>
</template>
