import { describe, it, expect } from "vitest";
import { allowMatch, findAllowMatch, certAllowed } from "./match";

describe("findAllowMatch", () => {
  it("fulltext 命中返回规则", () => {
    const rules = [
      { type: "fulltext" as const, pattern: "app.example.com" },
      { type: "suffix" as const, pattern: "example.com" },
    ];
    const result = findAllowMatch("app.example.com", rules);
    expect(result).toEqual({ type: "fulltext", pattern: "app.example.com" });
  });

  it("suffix 命中返回规则", () => {
    const rules = [{ type: "suffix" as const, pattern: "example.com" }];
    const result = findAllowMatch("foo.example.com", rules);
    expect(result).toEqual({ type: "suffix", pattern: "example.com" });
  });

  it("无命中返回 null", () => {
    const rules = [{ type: "suffix" as const, pattern: "example.com" }];
    expect(findAllowMatch("other.org", rules)).toBeNull();
  });

  it("空规则返回 null", () => {
    expect(findAllowMatch("example.com", [])).toBeNull();
  });

  it("优先级为数组序", () => {
    const rules = [
      { type: "fulltext" as const, pattern: "example.com" },
      { type: "suffix" as const, pattern: "example.com" },
    ];
    const result = findAllowMatch("example.com", rules);
    expect(result?.type).toBe("fulltext");
  });
});

describe("allowMatch", () => {
  it("fulltext exact match", () => {
    const rules = [{ type: "fulltext" as const, pattern: "app.example.com" }];
    expect(allowMatch("app.example.com", rules)).toBe(true);
    expect(allowMatch("other.example.com", rules)).toBe(false);
  });

  it("suffix label-aligned match", () => {
    const rules = [{ type: "suffix" as const, pattern: "example.com" }];
    expect(allowMatch("example.com", rules)).toBe(true);
    expect(allowMatch("foo.example.com", rules)).toBe(true);
    expect(allowMatch("a.b.example.com", rules)).toBe(true);
    expect(allowMatch("notexample.com", rules)).toBe(false);
    expect(allowMatch("other.org", rules)).toBe(false);
  });

  it("empty rules → deny", () => {
    expect(allowMatch("example.com", [])).toBe(false);
  });

  it("pattern with * treated as literal", () => {
    const rules = [{ type: "fulltext" as const, pattern: "*.example.com" }];
    expect(allowMatch("*.example.com", rules)).toBe(true);
    expect(allowMatch("foo.example.com", rules)).toBe(false);
  });

  it("wildcard domain 命中 suffix 规则", () => {
    const rules = [{ type: "suffix" as const, pattern: "example.com" }];
    expect(allowMatch("*.example.com", rules)).toBe(true);
    expect(allowMatch("*.sub.example.com", rules)).toBe(true);
    expect(allowMatch("*.other.com", rules)).toBe(false);
  });

  it("multiple rules: any match → true", () => {
    const rules = [
      { type: "fulltext" as const, pattern: "a.com" },
      { type: "suffix" as const, pattern: "b.com" },
    ];
    expect(allowMatch("a.com", rules)).toBe(true);
    expect(allowMatch("sub.b.com", rules)).toBe(true);
    expect(allowMatch("c.com", rules)).toBe(false);
  });
});

describe("certAllowed", () => {
  const rules = [{ type: "suffix" as const, pattern: "example.com" }];

  it("primary + 全部 alt 通过 → true", () => {
    expect(certAllowed("a.example.com", ["b.example.com"], rules)).toBe(true);
  });

  it("primary 通过但某 alt 越权 → false", () => {
    expect(certAllowed("a.example.com", ["b.other.com"], rules)).toBe(false);
  });

  it("primary 越权 → false", () => {
    expect(certAllowed("a.other.com", ["b.example.com"], rules)).toBe(false);
  });

  it("无 alt，仅 primary 通过 → true", () => {
    expect(certAllowed("a.example.com", [], rules)).toBe(true);
  });

  it("空规则 → false", () => {
    expect(certAllowed("a.example.com", [], [])).toBe(false);
  });

  it("wildcard SAN 通过 suffix", () => {
    expect(certAllowed("example.com", ["*.example.com"], rules)).toBe(true);
  });
});
