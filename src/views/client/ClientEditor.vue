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
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { EntitySelect } from "@/components/acrux-ui/fields";
import { useClientStore } from "@/stores/clients";
import { useAcmeAccountStore } from "@/stores/acmeAccounts";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2 } from "@lucide/vue";
import type { acmeAccount } from "@server/core/acme-accounts";

const props = defineProps<{ id: string | undefined }>();
const emit = defineEmits<{ (e: "close"): void }>();

const id = computed(() => props.id);
const { useUpsert } = useClientStore();
const [form, issues, status, submit] = useUpsert(id);

// ACME 账户候选池。
const { useAll: useAllAccounts } = useAcmeAccountStore();
const [accounts, accountsStatus] = useAllAccounts();

// EntitySelect 是多选；这里语义为单选，用长度 1 的数组桥接。
const selectedAccount = computed<string[]>(() =>
  form.acmeAccountId ? [form.acmeAccountId] : [],
);
const onSelectAccount = (ids: string[]) => {
  // 取最后选中的，实现「单选」语义。
  form.acmeAccountId = ids.length ? (ids[ids.length - 1] ?? null) : null;
};
const transformAccount = (a: acmeAccount.AcmeAccount) => ({
  id: a.id,
  searchText: `${a.name} ${a.email}`,
  title: a.name || a.id.slice(0, 8),
  summary: a.email || a.acmeUrl,
});

const genToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  form.token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
};

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
    <FieldLegend>{{ id ? "编辑" : "新建" }}客户端</FieldLegend>
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
        <FieldLabel for="token">Token</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="token"
            v-model="form.token"
            autocomplete="off"
            placeholder="调用凭据"
            class="font-mono"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              title="生成随机 token"
              @click="genToken"
            >
              <RefreshCw />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel>ACME 账户</FieldLabel>
        <EntitySelect
          :model-value="selectedAccount"
          :items="accounts"
          :status="accountsStatus"
          :transform-fn="transformAccount"
          placeholder="未绑定账户"
          @update:model-value="onSelectAccount"
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
            <select
              v-model="rule.type"
              class="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <option value="fulltext">全文</option>
              <option value="suffix">后缀</option>
            </select>
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
