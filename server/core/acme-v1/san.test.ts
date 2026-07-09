import { describe, it, expect } from "vitest";
import { needNewKeypair } from "./san";

describe("needNewKeypair", () => {
  it("完全一致 → false", () => {
    expect(needNewKeypair(["a.com"], ["a.com"])).toBe(false);
  });

  it("多域名完全一致（顺序无关）→ false", () => {
    expect(needNewKeypair(["a.com", "b.com"], ["b.com", "a.com"])).toBe(false);
  });

  it("请求是旧 SAN 子集 → false", () => {
    expect(needNewKeypair(["a.com"], ["a.com", "b.com"])).toBe(false);
  });

  it("新增域名 → true", () => {
    expect(needNewKeypair(["a.com", "b.com"], ["a.com"])).toBe(true);
  });

  it("旧 alt 为空 → true", () => {
    expect(needNewKeypair(["a.com"], [])).toBe(true);
  });
});
