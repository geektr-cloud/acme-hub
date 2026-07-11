import { z } from "zod";
import { type Equals, assert } from "tsafe";
import type { ResourceLock } from "@server/db/schema";

// ── field definitions ─────────────────────────────────────────────────────────

const id = z.string();
const owner = z.string();
const remark = z.string();
const expiresAt = z.string();
const createdAt = z.string();

// ── base schema ───────────────────────────────────────────────────────────────

export const resourceLock = z.object({
  id,
  owner,
  remark,
  expiresAt,
  createdAt,
});
assert<Equals<z.infer<typeof resourceLock>, ResourceLock>>();
export type { ResourceLock };

export const newItem = (): ResourceLock => ({
  id: "",
  owner: "",
  remark: "",
  expiresAt: "",
  createdAt: "",
});

// ── api schemas ───────────────────────────────────────────────────────────────
// 本实体不暴露 CRUD 路由，仅内部使用。
