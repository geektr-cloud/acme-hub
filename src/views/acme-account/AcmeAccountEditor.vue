<script setup lang="ts">
import { computed } from "vue";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/acrux-ui/fields";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import { Button } from "@/components/ui/button";
import type { acmeAccount as acmeAccountSchema } from "@server/core/acme-accounts";
import { isLetsEncrypt } from "./acme";

const props = defineProps<{ id: string | undefined }>();
const emit = defineEmits<{ (e: "close"): void }>();

const id = computed(() => props.id);
const { useUpsert } = useAcmeAccountStore();
const [form, issues, status, submit] = useUpsert(id);

// 预制目录 URL。
const acmeOptions = [
  {
    value: "https://acme-v02.api.letsencrypt.org/directory",
    label: "Let's Encrypt",
  },
  { value: "https://acme.zerossl.com/v2/DV90", label: "ZeroSSL" },
  {
    value: "https://acme-staging-v02.api.letsencrypt.org/directory",
    label: "Let's Encrypt Staging",
  },
];

// 非 Let's Encrypt 目录均需 EAB。
const showEab = computed(() => !isLetsEncrypt(form.acmeUrl));

// creds 子字段的读写桥：null 时按需创建对象，写空时尽量收敛回 null。
type Creds = acmeAccountSchema.Creds;
const credField = <K extends keyof Creds>(key: K) =>
  computed<string>({
    get: () => (form.creds?.[key] as string | undefined) ?? "",
    set: (v: string) => writeCreds(key, v),
  });

const writeCreds = <K extends keyof Creds>(
  key: K,
  value: Creds[K] | string,
) => {
  const next: Creds = { ...(form.creds ?? {}) };
  if (value === "" || value === null || value === undefined) delete next[key];
  else next[key] = value as Creds[K];
  form.creds = isEmptyCreds(next) ? null : next;
};

const isEmptyCreds = (c: Creds) =>
  !c.privateKey &&
  !c.publicKey &&
  !c.accountUrl &&
  !(c.eab && (c.eab.kid || c.eab.hmacKey));

const privateKey = credField("privateKey");
const publicKey = credField("publicKey");
const accountUrl = credField("accountUrl");

// EAB 是 creds 下的嵌套对象，单独桥接两个子字段。
const eabKid = computed<string>({
  get: () => form.creds?.eab?.kid ?? "",
  set: (v) => writeEab("kid", v),
});
const eabHmacKey = computed<string>({
  get: () => form.creds?.eab?.hmacKey ?? "",
  set: (v) => writeEab("hmacKey", v),
});
const writeEab = (key: "kid" | "hmacKey", value: string) => {
  const eab = {
    kid: form.creds?.eab?.kid ?? "",
    hmacKey: form.creds?.eab?.hmacKey ?? "",
    [key]: value,
  };
  writeCreds("eab", eab.kid || eab.hmacKey ? eab : null);
};

const onSave = async () => {
  if (!(await issues.validate())) return;
  await submit();
  emit("close");
};
</script>

<template>
  <FieldSet class="w-2xl">
    <FieldLegend>{{ id ? "编辑" : "新建" }} ACME 账户</FieldLegend>
    <FieldGroup>
      <Field :data-invalid="issues.errors('name').length > 0">
        <FieldLabel for="name">名称</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="name"
            v-model="form.name"
            autocomplete="off"
            placeholder="如 Let's Encrypt 生产"
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
      <Field :data-invalid="issues.errors('email').length > 0">
        <FieldLabel for="email">邮箱</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="email"
            v-model="form.email"
            type="email"
            autocomplete="off"
            placeholder="account@example.com"
            @focus="issues.ingore('email')"
          />
        </InputGroup>
        <FieldError :errors="issues.errors('email')" />
      </Field>
      <Field>
        <FieldLabel>ACME 目录</FieldLabel>
        <Select
          v-model="form.acmeUrl"
          :items="acmeOptions"
          placeholder="选择 ACME 目录"
        />
      </Field>

      <FieldLegend class="mt-2 text-sm text-zinc-400"
        >凭据（敏感，由签发流程生成，可手动填入）</FieldLegend
      >
      <Field v-if="showEab">
        <FieldLabel for="eabKid">EAB Kid</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="eabKid"
            v-model="eabKid"
            autocomplete="off"
            placeholder="ZeroSSL 等 CA 提供"
            class="font-mono"
          />
        </InputGroup>
      </Field>
      <Field v-if="showEab">
        <FieldLabel for="eabHmacKey">EAB HMAC Key</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="eabHmacKey"
            v-model="eabHmacKey"
            autocomplete="off"
            placeholder="ZeroSSL 等 CA 提供"
            class="font-mono"
          />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="accountUrl">账户 URL (kid)</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="accountUrl"
            v-model="accountUrl"
            autocomplete="off"
            placeholder="CA 返回的账户资源 URL"
          />
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel for="privateKey">私钥 (PEM)</FieldLabel>
        <Textarea
          id="privateKey"
          v-model="privateKey"
          class="font-mono text-xs"
          rows="5"
          spellcheck="false"
        />
      </Field>
      <Field>
        <FieldLabel for="publicKey">公钥 (PEM)</FieldLabel>
        <Textarea
          id="publicKey"
          v-model="publicKey"
          class="font-mono text-xs"
          rows="5"
          spellcheck="false"
        />
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
