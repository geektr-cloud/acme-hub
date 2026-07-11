import { describe, it, expect } from "vitest";
import { decideByInfo, renewAt, cacheControl } from "./decide";
import { RENEW_RATIO } from "./config";

const d = (iso: string) => new Date(iso);

describe("decideByInfo", () => {
  it("寿命未过半 → cache", () => {
    const result = decideByInfo(
      {
        notBefore: d("2025-01-01T00:00:00Z"),
        notAfter: d("2025-12-31T00:00:00Z"),
      },
      d("2025-06-01T00:00:00Z").getTime(),
    );
    expect(result.mode).toBe("cache");
    if (result.mode === "cache") {
      expect(result.renewAt).toBeInstanceOf(Date);
    }
  });

  it("寿命过半 → renew", () => {
    const result = decideByInfo(
      {
        notBefore: d("2025-01-01T00:00:00Z"),
        notAfter: d("2025-12-31T00:00:00Z"),
      },
      d("2025-09-01T00:00:00Z").getTime(),
    );
    expect(result.mode).toBe("renew");
  });

  it("已过期 → renew", () => {
    const result = decideByInfo(
      {
        notBefore: d("2024-01-01T00:00:00Z"),
        notAfter: d("2024-12-31T00:00:00Z"),
      },
      d("2025-01-01T00:00:00Z").getTime(),
    );
    expect(result.mode).toBe("renew");
  });

  it("lifetime <= 0 → renew", () => {
    const result = decideByInfo(
      {
        notBefore: d("2025-06-01T00:00:00Z"),
        notAfter: d("2025-06-01T00:00:00Z"),
      },
      d("2025-06-01T00:00:00Z").getTime(),
    );
    expect(result.mode).toBe("renew");
  });

  it("边界：恰好在 RENEW_RATIO 位置 → renew", () => {
    const notBefore = d("2025-01-01T00:00:00Z");
    const notAfter = d("2025-01-01T10:00:00Z");
    const lifetime = notAfter.getTime() - notBefore.getTime();
    const boundary = notBefore.getTime() + Math.floor(lifetime * RENEW_RATIO);
    const result = decideByInfo({ notBefore, notAfter }, boundary);
    expect(result.mode).toBe("renew");
  });
});

describe("renewAt", () => {
  it("计算正确", () => {
    const info = {
      notBefore: d("2025-01-01T00:00:00Z"),
      notAfter: d("2025-01-01T10:00:00Z"),
    };
    const result = renewAt(info);
    const expected = info.notBefore.getTime() + 10 * 3600_000 * RENEW_RATIO;
    expect(result.getTime()).toBe(expected);
  });

  it("RENEW_RATIO=2/3 验证：notBefore=0, notAfter=90天 → renewAt===60天", () => {
    const notBefore = d("2025-01-01T00:00:00Z");
    const notAfter = new Date(notBefore.getTime() + 90 * 86400_000);
    const result = renewAt({ notBefore, notAfter });
    const expected60d = notBefore.getTime() + 60 * 86400_000;
    expect(result.getTime()).toBe(expected60d);
  });
});

describe("cacheControl", () => {
  it("距 renewAt >1天 → max-age=...", () => {
    const now = d("2025-06-01T00:00:00Z").getTime();
    const ra = d("2025-06-10T00:00:00Z");
    const cc = cacheControl(ra, now);
    expect(cc).toMatch(/^max-age=\d+$/);
    expect(cc).not.toBe("max-age=0, must-revalidate");
  });

  it("距 renewAt <1天 → max-age=0, must-revalidate", () => {
    const now = d("2025-06-09T00:00:01Z").getTime();
    const ra = d("2025-06-10T00:00:00Z");
    const cc = cacheControl(ra, now);
    expect(cc).toBe("max-age=0, must-revalidate");
  });

  it("已过 renewAt → max-age=0, must-revalidate", () => {
    const now = d("2025-06-11T00:00:00Z").getTime();
    const ra = d("2025-06-10T00:00:00Z");
    const cc = cacheControl(ra, now);
    expect(cc).toBe("max-age=0, must-revalidate");
  });

  it("renewAt - now 恰好等于 1 天 → max-age=0, must-revalidate", () => {
    const ra = d("2025-06-10T00:00:00Z");
    const now = ra.getTime() - 86400_000;
    expect(cacheControl(ra, now)).toBe("max-age=0, must-revalidate");
  });

  it("now 已远超 renewAt → max-age=0, must-revalidate（不出现负数）", () => {
    const ra = d("2025-01-01T00:00:00Z");
    const now = d("2025-12-31T00:00:00Z").getTime();
    expect(cacheControl(ra, now)).toBe("max-age=0, must-revalidate");
  });
});
