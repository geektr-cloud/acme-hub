import { describe, it, expect } from "vitest";
import {
  isWildcard,
  assertValidDomainName,
  coversDomain,
  certCoversAll,
  scoreCert,
  pickBestCert,
} from "./coverage";

describe("isWildcard", () => {
  it("*.example.com", () => expect(isWildcard("*.example.com")).toBe(true));
  it("example.com", () => expect(isWildcard("example.com")).toBe(false));
});

describe("assertValidDomainName", () => {
  it("合法通配", () =>
    expect(() => assertValidDomainName("*.foobar.com")).not.toThrow());
  it("合法普通", () =>
    expect(() => assertValidDomainName("a.b.com")).not.toThrow());
  it("非法 *foobar.com", () =>
    expect(() => assertValidDomainName("*foobar.com")).toThrow());
  it("非法 a.*.com", () =>
    expect(() => assertValidDomainName("a.*.com")).toThrow());
  it("非法 *.*.com", () =>
    expect(() => assertValidDomainName("*.*.com")).toThrow());
});

describe("coversDomain", () => {
  const san = ["foobar.com", "*.foobar.com"];

  it("覆盖 foobar.com", () =>
    expect(coversDomain(san, "foobar.com")).toBe(true));
  it("覆盖 *.foobar.com", () =>
    expect(coversDomain(san, "*.foobar.com")).toBe(true));
  it("覆盖 apple.foobar.com", () =>
    expect(coversDomain(san, "apple.foobar.com")).toBe(true));
  it("不覆盖 banana.apple.foobar.com", () =>
    expect(coversDomain(san, "banana.apple.foobar.com")).toBe(false));
  it("不覆盖 *.apple.foobar.com", () =>
    expect(coversDomain(san, "*.apple.foobar.com")).toBe(false));
  it("不覆盖 other.com", () =>
    expect(coversDomain(san, "other.com")).toBe(false));

  it("请求通配 *.foobar.com，SAN 只有裸域 [foobar.com] → 不覆盖", () => {
    expect(coversDomain(["foobar.com"], "*.foobar.com")).toBe(false);
  });

  it("请求通配 *.foobar.com，SAN 含 [*.foobar.com] → 覆盖", () => {
    expect(coversDomain(["*.foobar.com"], "*.foobar.com")).toBe(true);
  });

  it("SAN 深层通配 *.apple.foobar.com 覆盖 x.apple.foobar.com", () => {
    expect(coversDomain(["*.apple.foobar.com"], "x.apple.foobar.com")).toBe(
      true,
    );
  });

  it("SAN 深层通配 *.apple.foobar.com 不覆盖裸域 apple.foobar.com", () => {
    expect(coversDomain(["*.apple.foobar.com"], "apple.foobar.com")).toBe(
      false,
    );
  });
});

describe("certCoversAll", () => {
  const san = ["foobar.com", "*.foobar.com"];
  it("全覆盖", () =>
    expect(certCoversAll(san, ["foobar.com", "apple.foobar.com"])).toBe(true));
  it("部分未覆盖", () =>
    expect(certCoversAll(san, ["foobar.com", "other.com"])).toBe(false));
});

describe("scoreCert", () => {
  it("通配 > exact > 其他具体", () => {
    const wildcard = ["*.example.com"];
    const exact = ["api.example.com"];
    const other = ["other.example.com"];
    const requested = ["api.example.com"];
    expect(scoreCert(wildcard, requested)).toBeGreaterThan(
      scoreCert(exact, requested),
    );
    expect(scoreCert(exact, requested)).toBeGreaterThan(
      scoreCert(other, requested),
    );
  });

  it("单通配 SAN 命中 → 恰好 1000", () => {
    expect(scoreCert(["*.example.com"], ["a.example.com"])).toBe(1000);
  });

  it("单 exact 命中 → 恰好 100，不叠加 +1", () => {
    expect(scoreCert(["a.example.com"], ["a.example.com"])).toBe(100);
  });

  it("单具体非命中 SAN → 1", () => {
    expect(scoreCert(["other.example.com"], ["a.example.com"])).toBe(1);
  });

  it("混合 SAN [foobar.com, *.foobar.com] 对 [foobar.com]：通配不覆盖裸域，仅 exact 100", () => {
    const san = ["foobar.com", "*.foobar.com"];
    expect(scoreCert(san, ["foobar.com"])).toBe(100);
  });

  it("通配条目未覆盖任何请求域名时不加分", () => {
    expect(scoreCert(["*.other.com"], ["a.example.com"])).toBe(0);
  });
});

describe("pickBestCert", () => {
  const certs = [
    {
      alt: ["api.example.com"],
      domain: "example.com",
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      alt: ["other.example.com"],
      domain: "example.com",
      createdAt: "2025-01-02T00:00:00Z",
    },
  ];

  it("exact 域名优先于其他具体", () => {
    const best = pickBestCert(certs, ["api.example.com"]);
    expect(best?.alt).toEqual(["api.example.com"]);
  });

  it("无覆盖返回 null", () => {
    const best = pickBestCert(certs, ["other.com"]);
    expect(best).toBeNull();
  });

  it("同分按 createdAt 降序", () => {
    const tie = [
      { alt: ["a.com"], domain: "a.com", createdAt: "2025-01-01T00:00:00Z" },
      { alt: ["a.com"], domain: "a.com", createdAt: "2025-06-01T00:00:00Z" },
    ];
    const best = pickBestCert(tie, ["a.com"]);
    expect(best?.createdAt).toBe("2025-06-01T00:00:00Z");
  });

  it("通配证书(+1000)胜过 exact 证书(+100)", () => {
    const pool = [
      {
        alt: ["*.example.com"],
        domain: "example.com",
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        alt: ["api.example.com"],
        domain: "example.com",
        createdAt: "2025-06-01T00:00:00Z",
      },
    ];
    const best = pickBestCert(pool, ["api.example.com"]);
    expect(best?.alt).toEqual(["*.example.com"]);
  });

  it("多域名请求：只全覆盖的证书进入候选", () => {
    const pool = [
      { alt: ["a.com"], domain: "a.com", createdAt: "2025-01-01T00:00:00Z" },
      {
        alt: ["a.com", "b.com"],
        domain: "a.com",
        createdAt: "2025-06-01T00:00:00Z",
      },
    ];
    const best = pickBestCert(pool, ["a.com", "b.com"]);
    expect(best?.alt).toEqual(["a.com", "b.com"]);
  });

  it("空候选列表 → null", () => {
    expect(pickBestCert([], ["a.com"])).toBeNull();
  });
});
