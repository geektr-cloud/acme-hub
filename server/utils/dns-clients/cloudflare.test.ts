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
  const value = `test-value-${randomHex}`;

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

  it("add → list → remove → list", async () => {
    await client.addTxt(zone, fqdn, value);

    const afterAdd = await client.listTxt(zone, fqdn);
    expect(afterAdd.some((r) => r.value === value)).toBe(true);

    await client.removeTxt(zone, fqdn, value);

    const afterRemove = await client.listTxt(zone, fqdn);
    expect(afterRemove.some((r) => r.value === value)).toBe(false);
  }, 30_000);

  it("removeTxt 幂等：对已删除记录不抛错", async () => {
    await expect(client.removeTxt(zone, fqdn, value)).resolves.toBeUndefined();
  }, 30_000);
});
