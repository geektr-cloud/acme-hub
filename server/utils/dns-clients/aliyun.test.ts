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
  const value = `test-value-${randomHex}`;

  afterAll(async () => {
    for (const fqdnToClean of [fqdn]) {
      try {
        const records = await client.listTxt(zone, fqdnToClean);
        for (const rec of records) {
          await client.removeTxt(zone, fqdnToClean, rec.value);
        }
      } catch (e) {
        console.warn(`cleanup failed for ${fqdnToClean}:`, e);
      }
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
