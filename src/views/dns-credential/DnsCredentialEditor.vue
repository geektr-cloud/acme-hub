<script setup lang="ts">
import { computed, watch } from "vue";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldDescription,
} from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Select } from "@/components/acrux-ui/fields";
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import { Button } from "@/components/ui/button";
import type { dnsCredential } from "@server/core/dns-credentials";

const props = defineProps<{ id: string | undefined }>();
const emit = defineEmits<{ (e: "close"): void }>();

const id = computed(() => props.id);
const { useUpsert } = useDnsCredentialStore();
const [form, issues, status, submit] = useUpsert(id);

const providerOptions = [
  { value: "cloudflare", label: "Cloudflare" },
  { value: "alicloud", label: "阿里云" },
];

type Creds = NonNullable<dnsCredential.Creds>;
const credField = (key: string) =>
  computed<string>({
    get: () => {
      const c = form.creds as Record<string, unknown> | null;
      return (c?.[key] as string | undefined) ?? "";
    },
    set: (v: string) => {
      const c: Record<string, string> = form.creds
        ? { ...(form.creds as Record<string, string>) }
        : {};
      if (v) c[key] = v;
      else delete c[key];
      form.creds = Object.keys(c).length > 0 ? (c as Creds) : null;
    },
  });

const apiToken = credField("apiToken");
const accessKeyId = credField("accessKeyId");
const accessKeySecret = credField("accessKeySecret");

// 切换 provider 时清空 creds，避免错配字段残留。
watch(
  () => form.provider,
  (next, prev) => {
    if (prev !== undefined && next !== prev) form.creds = null;
  },
);

const onSave = async () => {
  if (!(await issues.validate())) return;
  await submit();
  emit("close");
};
</script>

<template>
  <FieldSet class="w-2xl">
    <FieldLegend>{{ id ? "编辑" : "新建" }} DNS 凭据</FieldLegend>
    <FieldGroup>
      <Field :data-invalid="issues.errors('name').length > 0">
        <FieldLabel for="name">名称</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="name"
            v-model="form.name"
            autocomplete="off"
            placeholder="如 生产 Cloudflare"
            @focus="issues.ingore('name')"
          />
        </InputGroup>
        <FieldError :errors="issues.errors('name')" />
      </Field>
      <Field>
        <FieldLabel for="description">描述</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="description"
            v-model="form.description"
            autocomplete="off"
            placeholder="可选"
          />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>DNS 服务商</FieldLabel>
        <Select
          v-model="form.provider"
          :items="providerOptions"
          placeholder="选择服务商"
        />
      </Field>

      <FieldLegend class="mt-2 text-sm text-zinc-400">凭据</FieldLegend>

      <template v-if="form.provider === 'cloudflare'">
        <Field>
          <FieldLabel for="apiToken">API Token</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="apiToken"
              v-model="apiToken"
              type="password"
              autocomplete="off"
              placeholder="Cloudflare scoped API Token"
              class="font-mono"
            />
          </InputGroup>
          <FieldDescription>
            建议使用 scoped API Token（Zone → DNS → Edit），不要使用 Global API
            Key
          </FieldDescription>
        </Field>
      </template>

      <template v-else-if="form.provider === 'alicloud'">
        <Field>
          <FieldLabel for="accessKeyId">AccessKey ID</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="accessKeyId"
              v-model="accessKeyId"
              autocomplete="off"
              placeholder="阿里云 RAM 子账号 AccessKey ID"
              class="font-mono"
            />
          </InputGroup>
          <FieldDescription>
            建议使用 RAM 子账号 + AliyunDNSFullAccess 权限
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel for="accessKeySecret">AccessKey Secret</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="accessKeySecret"
              v-model="accessKeySecret"
              type="password"
              autocomplete="off"
              placeholder="阿里云 RAM 子账号 AccessKey Secret"
              class="font-mono"
            />
          </InputGroup>
        </Field>
      </template>
    </FieldGroup>
  </FieldSet>
  <div class="mt-4 flex justify-end gap-2">
    <Button :disabled="status.loading" @click="onSave">保存</Button>
    <Button
      variant="secondary"
      :disabled="status.loading"
      @click="emit('close')"
      >取消</Button
    >
  </div>
</template>
