import { describe, it, expect, afterAll } from "vitest";
import { fqdnToRr } from "./base";
import { createAliyunDnsClient } from "./aliyun";

describe("fqdnToRr", () => {
  it("子域", () => {
    expect(fqdnToRr("anitya.cn", "_acme-challenge.foo.anitya.cn")).toBe(
      "_acme-challenge.foo",
    );
  });

  it("多级子域", () => {
    expect(fqdnToRr("anitya.cn", "a.b.c.anitya.cn")).toBe("a.b.c");
  });

  it("fqdn === zone → @", () => {
    expect(fqdnToRr("anitya.cn", "anitya.cn")).toBe("@");
  });

  it("fqdn 不属于 zone 时抛错", () => {
    expect(() => fqdnToRr("anitya.cn", "example.com")).toThrow(
      'fqdn "example.com" is not under zone "anitya.cn"',
    );
  });

  it("易混淆后缀不匹配", () => {
    expect(() => fqdnToRr("anitya.cn", "test.notanitya.cn")).toThrow();
  });
});

const hasCreds =
  !!process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
  !!process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

describe.runIf(hasCreds)("aliyun integration", () => {
  const creds = {
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID!,
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET!,
  };
  const client = createAliyunDnsClient(creds);
  const zone = "anitya.cn";
  const randomHex = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const fqdn = `_acme-hub-test-${randomHex}.${zone}`;

  afterAll(async () => {
    try {
      const records = await client.listTxt(zone, fqdn);
      for (const rec of records) {
        await client.removeTxt(zone, fqdn, rec.value);
      }
    } catch (e) {
      console.warn(`cleanup failed for ${fqdn}:`, e);
    }
  });

  it("ensureTxt 创建新记录", async () => {
    await client.ensureTxt(zone, fqdn, "val-1", "test-tag-1");
    const records = await client.listTxt(zone, fqdn);
    expect(records.some((r) => r.value === "val-1")).toBe(true);
  }, 30_000);

  it("ensureTxt 幂等：相同 value + remark 不重复创建", async () => {
    await client.ensureTxt(zone, fqdn, "val-1", "test-tag-1");
    const records = await client.listTxt(zone, fqdn);
    const matched = records.filter((r) => r.value === "val-1");
    expect(matched.length).toBe(1);
  }, 30_000);

  it("同 FQDN 双值并存 + removeTxt 精确删除", async () => {
    await client.ensureTxt(zone, fqdn, "val-a", "test-a");
    await client.ensureTxt(zone, fqdn, "val-b", "test-b");
    const records = await client.listTxt(zone, fqdn);
    expect(records.some((r) => r.value === "val-a")).toBe(true);
    expect(records.some((r) => r.value === "val-b")).toBe(true);

    await client.removeTxt(zone, fqdn, "val-a");
    const after = await client.listTxt(zone, fqdn);
    expect(after.some((r) => r.value === "val-a")).toBe(false);
    expect(after.some((r) => r.value === "val-b")).toBe(true);
  }, 30_000);

  it("removeTxt 清理 + 幂等", async () => {
    const records = await client.listTxt(zone, fqdn);
    for (const rec of records) {
      await client.removeTxt(zone, fqdn, rec.value);
    }
    const after = await client.listTxt(zone, fqdn);
    expect(after.length).toBe(0);
    await expect(
      client.removeTxt(zone, fqdn, "nonexistent"),
    ).resolves.toBeUndefined();
  }, 30_000);
});
