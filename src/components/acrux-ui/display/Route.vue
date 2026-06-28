<script setup lang="ts">
import { Badge, type BadgeVariants } from "@/components/ui/badge";
import type { RouteLocationRaw } from "vue-router";
import { Minus } from "@lucide/vue";

defineOptions({ name: "DataRoute" });
defineProps<{
  to?: RouteLocationRaw | null;
  variant?: BadgeVariants["variant"] | "raw";
}>();
</script>

<template>
  <RouterLink :to="to ?? ''" class="underline">
    <Badge v-if="variant !== 'raw'" as-child v-bind="$attrs" :variant="variant">
      <slot>
        <Minus />
      </slot>
    </Badge>
    <template v-else>
      <slot>
        <Minus />
      </slot>
    </template>
  </RouterLink>
</template>
