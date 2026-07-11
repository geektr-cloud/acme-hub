import { describe, it, expect } from "vitest";
import { pickPrimaryDomain } from "./domain";

describe("pickPrimaryDomain", () => {
  it("foobar.anitya.cn + 通配 → foobar.anitya.cn", () => {
    expect(pickPrimaryDomain(["foobar.anitya.cn", "*.foobar.anitya.cn"])).toBe(
      "foobar.anitya.cn",
    );
  });

  it("*.foobar.com.cn → foobar.com.cn", () => {
    expect(pickPrimaryDomain(["*.foobar.com.cn"])).toBe("foobar.com.cn");
  });

  it("通配在首位时剥前缀", () => {
    expect(pickPrimaryDomain(["*.a.com", "b.a.com"])).toBe("a.com");
  });

  it("非通配原样", () => {
    expect(pickPrimaryDomain(["a.b.com"])).toBe("a.b.com");
  });
});
