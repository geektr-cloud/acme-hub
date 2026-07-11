import { describe, it, expect } from "vitest";
import { sha256Hex, certHashOf, lockIdOf } from "./hash";

describe("sha256Hex", () => {
  it("稳定性", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("hello");
    expect(a).toBe(b);
  });

  it("不同输入不同结果", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("world");
    expect(a).not.toBe(b);
  });
});

describe("certHashOf", () => {
  it("排序无关性", async () => {
    const a = await certHashOf("acc1", ["x.com", "y.com"]);
    const b = await certHashOf("acc1", ["y.com", "x.com"]);
    expect(a).toBe(b);
  });

  it("不同账户不同 hash", async () => {
    const a = await certHashOf("acc1", ["x.com"]);
    const b = await certHashOf("acc2", ["x.com"]);
    expect(a).not.toBe(b);
  });
});

describe("lockIdOf", () => {
  it("稳定性", async () => {
    const a = await lockIdOf("example.com");
    const b = await lockIdOf("example.com");
    expect(a).toBe(b);
  });

  it("不同域名不同 id", async () => {
    const a = await lockIdOf("a.com");
    const b = await lockIdOf("b.com");
    expect(a).not.toBe(b);
  });
});
