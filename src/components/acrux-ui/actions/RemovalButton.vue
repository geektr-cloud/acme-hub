<script setup lang="ts">
import Button from "@/components/ui/button/Button.vue";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { IconBtn } from "@/components/acrux-ui/base";
import { PopoverClose } from "reka-ui";
import { Check, Trash, X } from "@lucide/vue";
import { useRouter } from "vue-router";
import type { Removal } from "@acrux/core";

const props = defineProps<{
  label?: string;
  confirm: string;
  ctx: Removal<unknown>;
}>();

const router = useRouter();

const [status, _remove] = props.ctx;

const remove = () =>
  _remove()
    .then(() => router.back())
    .catch(() => {});
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="destructive">
        <Trash />
        <slot>{{ label }}</slot>
      </Button>
    </PopoverTrigger>
    <PopoverContent side="left" class="w-auto">
      <div class="flex flex-row items-center gap-2">
        <div>{{ confirm }}</div>
        <IconBtn variant="secondary" :disabled="status.loading" @click="void remove()">
          <Check v-if="!status.loading" />
          <Spinner v-else />
        </IconBtn>
        <PopoverClose as-child>
          <IconBtn :as="X" v-show="!status.loading" />
        </PopoverClose>
      </div>
      <p v-if="status.error" class="text-red-500">{{ status.error }}</p>
    </PopoverContent>
  </Popover>
</template>
