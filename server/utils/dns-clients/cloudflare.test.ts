import { describe, it, expect, afterAll } from "vitest";
import { createCloudflareDnsClient, stripQuotes } from "./cloudflare";

describe("stripQuotes", () => {
  it("带引号", () => {
    expect(stripQuotes('"abc"')).toBe("abc");
  });

  it("不带引号原样", () => {
    expect(stripQuotes("abc")).toBe("abc");
  });

  it("只有单边引号原样", () => {
    expect(stripQuotes('"abc')).toBe('"abc');
    expect(stripQuotes('abc"')).toBe('abc"');
  });

  it("空串", () => {
    expect(stripQuotes("")).toBe("");
  });

  it("只有两个引号", () => {
    expect(stripQuotes('""')).toBe("");
  });
});

const hasCreds =
  !!process.env.CLOUDFLARE_API_TOKEN && !!process.env.CLOUDFLARE_TEST_DOMAIN;

describe.runIf(hasCreds)("cloudflare integration", () => {
  const creds = {
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  };
  const client = createCloudflareDnsClient(creds);
  const zone = process.env.CLOUDFLARE_TEST_DOMAIN!;
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
