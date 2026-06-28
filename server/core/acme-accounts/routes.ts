import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { HttpErr, paramId } from "@acrux/server";
import { db, schema } from "@server/db";
import { ensureRegistered } from "./registrar";
import * as acmeAccountSchema from "./schema";

const notFound = "ACME account not found";

const findById = async (id: string) => {
  const [row] = await db
    .select()
    .from(schema.acmeAccounts)
    .where(eq(schema.acmeAccounts.id, id));
  return row;
};

// 删除账户前，置空引用它的 client / certificate（schema 注明悬挂引用由应用层处理）。
const cascadeReferences = async (id: string) => {
  await db
    .update(schema.clients)
    .set({ acmeAccountId: null })
    .where(eq(schema.clients.acmeAccountId, id));
  await db
    .update(schema.certificates)
    .set({ acmeAccountId: null })
    .where(eq(schema.certificates.acmeAccountId, id));
};

// 标准 6-endpoint CRUD，链式调用以保留 AppType RPC 推断。
// 与 createCrudRoutes 工厂的差异：写路径（POST、PUT、PUT /:id）在落库前调 ensureRegistered，
// 凭据缺失则自动生成 ECDSA 密钥对并向 CA 注册账户。
export const acmeAccountRoutes = new Hono()
  .get("/", async (c) => {
    const items = await db
      .select()
      .from(schema.acmeAccounts)
      .orderBy(desc(schema.acmeAccounts.createdAt));
    return c.json(items);
  })
  .get("/:id", paramId, async (c) => {
    const row = await findById(c.req.valid("param").id);
    if (!row) throw HttpErr(404, notFound);
    return c.json(row);
  })
  .post("/", zValidator("json", acmeAccountSchema.create.body), async (c) => {
    const data = c.req.valid("json");
    const creds = await ensureRegistered(data);
    const [row] = await db
      .insert(schema.acmeAccounts)
      .values({ ...data, creds })
      .returning();
    return c.json(row);
  })
  .put("/", zValidator("json", acmeAccountSchema.upsert.body), async (c) => {
    const { id, ...data } = c.req.valid("json");
    const creds = await ensureRegistered(data);
    if (id) {
      if (!(await findById(id))) throw HttpErr(404, notFound);
      const [row] = await db
        .update(schema.acmeAccounts)
        .set({ ...data, creds })
        .where(eq(schema.acmeAccounts.id, id))
        .returning();
      return c.json(row);
    }
    const [row] = await db
      .insert(schema.acmeAccounts)
      .values({ ...data, creds })
      .returning();
    return c.json(row);
  })
  .put(
    "/:id",
    paramId,
    zValidator("json", acmeAccountSchema.create.body),
    async (c) => {
      const { id } = c.req.valid("param");
      if (!(await findById(id))) throw HttpErr(404, notFound);
      const data = c.req.valid("json");
      const creds = await ensureRegistered(data);
      const [row] = await db
        .update(schema.acmeAccounts)
        .set({ ...data, creds })
        .where(eq(schema.acmeAccounts.id, id))
        .returning();
      return c.json(row);
    },
  )
  .delete("/:id", paramId, async (c) => {
    const { id } = c.req.valid("param");
    if (!(await findById(id))) throw HttpErr(404, notFound);
    await cascadeReferences(id);
    const [row] = await db
      .delete(schema.acmeAccounts)
      .where(eq(schema.acmeAccounts.id, id))
      .returning();
    return c.json(row);
  });
