<script setup lang="ts">
import { computed } from "vue";
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
import { useDomainStore } from "@/stores/domains";
import { useDnsCredentialStore } from "@/stores/dnsCredentials";
import { Button } from "@/components/ui/button";
import type { dnsCredential } from "@server/core/dns-credentials";

const props = defineProps<{ id: string | undefined }>();
const emit = defineEmits<{ (e: "close"): void }>();

const id = computed(() => props.id);
const { useUpsert } = useDomainStore();
const [form, issues, status, submit] = useUpsert(id);

const { useAll: useAllCredentials } = useDnsCredentialStore();
const [credentials, credentialsStatus] = useAllCredentials();

const transformCredential = (c: dnsCredential.DnsCredential) => ({
  value: c.id,
  label: c.name || c.id.slice(0, 8),
});

const onSave = async () => {
  if (!(await issues.validate())) return;
  await submit();
  emit("close");
};
</script>

<template>
  <FieldSet class="w-2xl">
    <FieldLegend>{{ id ? "编辑" : "新建" }}域名</FieldLegend>
    <FieldGroup>
      <Field :data-invalid="issues.errors('name').length > 0">
        <FieldLabel for="name">域名</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="name"
            v-model="form.name"
            autocomplete="off"
            placeholder="如 example.com 或 sub.example.com"
            class="font-mono"
            @focus="issues.ingore('name')"
          />
        </InputGroup>
        <FieldDescription> 支持根域和子域，禁止通配符 *. </FieldDescription>
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
        <FieldLabel>DNS 凭据</FieldLabel>
        <Select
          v-model="form.dnsCredentialId"
          :items="credentials"
          :status="credentialsStatus"
          :transform-fn="transformCredential"
          placeholder="未绑定凭据"
          clearable
        />
        <FieldDescription>
          未绑定凭据的域名暂不可用于证书签发
        </FieldDescription>
      </Field>
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
