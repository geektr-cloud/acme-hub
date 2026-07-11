<script setup lang="ts">
import { ref, reactive } from "vue";
import { useAsyncState, useHonoApi } from "@acrux/core";
import { client } from "@/utils/api";
import { PageEntry } from "@/components/acrux-ui/page";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldDescription,
} from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import type { setting } from "@server/core/settings";

const fetchSettings = useHonoApi(() => client.api.settings.$get());
const updateSettings = useHonoApi((json: Partial<setting.Settings>) =>
  client.api.settings.$put({ json }),
);

const form = reactive<setting.Settings>({
  renew_window_ratio: "",
  admin_password: "",
});

const [, status, reload] = useAsyncState(
  async () => {
    const result = await fetchSettings();
    form.renew_window_ratio = result.renew_window_ratio;
    form.admin_password = result.admin_password;
    return result;
  },
  null,
  { immediate: true },
);

const saving = ref(false);
const saveError = ref<string | null>(null);

async function handleSave() {
  saving.value = true;
  saveError.value = null;
  try {
    const result = await updateSettings(form);
    form.renew_window_ratio = result.renew_window_ratio;
    form.admin_password = result.admin_password;
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageEntry
    title="全局配置"
    description="管理全局配置项，修改后立即生效"
    :loading="status.loading"
    :error="status.error"
    :on-retry="() => reload()"
  >
    <FieldSet class="max-w-2xl">
      <FieldLegend>全局配置</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel for="renew_window_ratio">续期窗口比例</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="renew_window_ratio"
              v-model="form.renew_window_ratio"
              placeholder="默认 0.66"
            />
          </InputGroup>
          <FieldDescription>
            证书有效期达到此比例时触发续期。范围 0-1，留空使用默认值 0.66。
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel for="admin_password">管理员密码</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="admin_password"
              v-model="form.admin_password"
              type="password"
              placeholder="默认使用环境变量 API_TOKEN"
            />
          </InputGroup>
          <FieldDescription>
            登录管理端使用的密码。留空则使用环境变量 API_TOKEN。
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div v-if="saveError" class="mt-2 text-sm text-destructive">
        {{ saveError }}
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button :disabled="saving || status.loading" @click="handleSave">
          {{ saving ? "保存中..." : "保存" }}
        </Button>
      </div>
    </FieldSet>
  </PageEntry>
</template>
