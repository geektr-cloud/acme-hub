import { describe, it, expect } from "vitest";
import { allowMatch } from "./match";

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
    // Not label-aligned: "notexample.com"
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
