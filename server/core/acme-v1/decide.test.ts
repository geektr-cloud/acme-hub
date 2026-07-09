import { describe, it, expect } from "vitest";
import { decideByInfo } from "./decide";
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
  });

  it("寿命过半 → renew", () => {
    const result = decideByInfo(
      {
        notBefore: d("2025-01-01T00:00:00Z"),
        notAfter: d("2025-12-31T00:00:00Z"),
      },
      d("2025-07-02T00:00:00Z").getTime(),
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
