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
import { Select } from "@/components/acrux-ui/fields";
import { useConsumerStore } from "@/stores/consumers";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "@lucide/vue";
import type { acmeAccount } from "@server/core/acme-accounts";

const props = defineProps<{ id: string | undefined }>();
const emit = defineEmits<{ (e: "close"): void }>();

const id = computed(() => props.id);
const { useUpsert } = useConsumerStore();
const [form, issues, status, submit] = useUpsert(id);

// ACME 账户候选池。
const { useAll: useAllAccounts } = useAcmeAccountStore();
const [accounts, accountsStatus] = useAllAccounts();

const transformAccount = (a: acmeAccount.AcmeAccount) => ({
  value: a.id,
  label: a.name || a.id.slice(0, 8),
});

const ruleTypes = [
  { value: "fulltext", label: "全文" },
  { value: "suffix", label: "后缀" },
];

const addRule = () => form.allow.push({ type: "suffix", pattern: "" });
const removeRule = (i: number) => form.allow.splice(i, 1);

const onSave = async () => {
  if (!(await issues.validate())) return;
  await submit();
  emit("close");
};
</script>

<template>
  <FieldSet class="w-2xl">
    <FieldLegend>{{ id ? "编辑" : "新建" }}消费者</FieldLegend>
    <FieldGroup>
      <Field :data-invalid="issues.errors('name').length > 0">
        <FieldLabel for="name">名称</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="name"
            v-model="form.name"
            autocomplete="off"
            placeholder="如 部署机器人"
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
        <FieldLabel>ACME 账户</FieldLabel>
        <Select
          v-model="form.acmeAccountId"
          :items="accounts"
          :status="accountsStatus"
          :transform-fn="transformAccount"
          placeholder="未绑定账户"
          clearable
        />
      </Field>
      <Field :data-invalid="issues.errors('allow').length > 0">
        <FieldLabel>允许的域名规则</FieldLabel>
        <div class="flex flex-col gap-2">
          <div
            v-for="(rule, i) in form.allow"
            :key="i"
            class="flex items-center gap-2"
          >
            <Select
              v-model="rule.type"
              :items="ruleTypes"
              class="w-24 shrink-0"
            />
            <InputGroup class="flex-1">
              <InputGroupInput
                v-model="rule.pattern"
                autocomplete="off"
                :placeholder="
                  rule.type === 'suffix' ? '.example.com' : 'app.example.com'
                "
                @focus="issues.ingore('allow')"
              />
            </InputGroup>
            <Button
              variant="ghost"
              size="icon"
              class="text-destructive hover:text-destructive"
              @click="removeRule(i)"
            >
              <Trash2 />
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            class="self-start"
            @click="addRule"
          >
            <Plus />添加规则
          </Button>
        </div>
        <FieldError :errors="issues.errors('allow')" />
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
