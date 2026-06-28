<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const router = useRouter();
const auth = useAuthStore();

const username = ref("root");
const password = ref("");
const error = ref("");
const loading = ref(false);

const submit = async () => {
  error.value = "";
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    const next = (router.currentRoute.value.query.next as string) || "/";
    router.push(next);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "登录失败";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 px-4"
  >
    <form class="w-full max-w-sm" @submit.prevent="submit">
      <FieldSet>
        <FieldLegend>登录</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel for="username">用户名</FieldLabel>
            <Input id="username" v-model="username" autocomplete="username" />
          </Field>
          <Field>
            <FieldLabel for="password">API Token</FieldLabel>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
            />
            <FieldError v-if="error" :errors="[error]" />
          </Field>
        </FieldGroup>
      </FieldSet>
      <div class="mt-4 flex justify-end">
        <Button type="submit" :disabled="loading || !password">{{
          loading ? "登录中..." : "登录"
        }}</Button>
      </div>
    </form>
  </div>
</template>
