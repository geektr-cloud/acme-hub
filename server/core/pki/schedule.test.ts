import { describe, it, expect } from "vitest";
import { windowStart, pickSlot, WINDOW_MS, LOOKBACK_WINDOWS } from "./schedule";

describe("windowStart", () => {
  it("归一到窗口起点（floor）", () => {
    // 2025-01-01T00:00:00Z 是窗口起点
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    expect(windowStart(t0)).toBe(t0);
  });

  it("窗口内任意点归一到起点", () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    // 1小时后
    const t1 = t0 + 3600_000;
    expect(windowStart(t1)).toBe(t0);
    // 2小时59分后
    const t2 = t0 + 2 * 3600_000 + 59 * 60_000;
    expect(windowStart(t2)).toBe(t0);
  });

  it("恰好跨窗口边界", () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    const t1 = t0 + WINDOW_MS; // 03:00:00Z
    expect(windowStart(t1)).toBe(t1);
    expect(windowStart(t1 - 1)).toBe(t0);
  });

  it("跨日窗口", () => {
    // 2025-01-01T21:00:00Z 窗口
    const t0 = new Date("2025-01-01T21:00:00Z").getTime();
    // 2025-01-02T00:00:00Z 窗口
    const t1 = new Date("2025-01-02T00:00:00Z").getTime();
    expect(windowStart(t0)).toBe(t0);
    expect(windowStart(t0 + WINDOW_MS - 1)).toBe(t0);
    expect(windowStart(t1)).toBe(t1);
  });
});

describe("pickSlot", () => {
  it("空 load 返回 t0", () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    const load = new Map<number, number>();
    expect(pickSlot(t0, load)).toBe(t0);
  });

  it("t0 拥挤而某早窗空 → 选早窗", () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    const load = new Map<number, number>();
    load.set(t0, 5); // t0 拥挤
    load.set(t0 - WINDOW_MS, 0); // 前一窗口空
    expect(pickSlot(t0, load)).toBe(t0 - WINDOW_MS);
  });

  it("全均匀 → 选 t0（平局取最晚）", () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    const load = new Map<number, number>();
    // 所有窗口负载相同
    for (let i = 0; i < LOOKBACK_WINDOWS; i++) {
      load.set(t0 - i * WINDOW_MS, 3);
    }
    expect(pickSlot(t0, load)).toBe(t0);
  });

  it("负载相同多窗 → 取最晚（最靠近理论时点）", () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    const load = new Map<number, number>();
    // 所有 56 个窗口负载相同
    for (let i = 0; i < LOOKBACK_WINDOWS; i++) {
      load.set(t0 - i * WINDOW_MS, 2);
    }
    // 应该返回 t0（最晚的窗口）
    expect(pickSlot(t0, load)).toBe(t0);
  });

  it("t0 负载高，多个空窗可选 → 取最晚（最靠近理论时点）", () => {
    const t0 = new Date("2025-01-01T00:00:00Z").getTime();
    const load = new Map<number, number>();
    load.set(t0, 10); // t0 很挤
    // 前 3 个窗口都空
    load.set(t0 - WINDOW_MS, 0);
    load.set(t0 - 2 * WINDOW_MS, 0);
    load.set(t0 - 3 * WINDOW_MS, 0);
    // 其他窗口设置较高负载，确保不会被选中
    for (let i = 4; i < LOOKBACK_WINDOWS; i++) {
      load.set(t0 - i * WINDOW_MS, 5);
    }
    // 应该选 t0 - WINDOW_MS（最晚的空窗）
    expect(pickSlot(t0, load)).toBe(t0 - WINDOW_MS);
  });

  it("理论时点不在窗口起点也能正确归一", () => {
    // 理论时点在窗口中间
    const t0 = new Date("2025-01-01T01:30:00Z").getTime();
    const expectedT0 = new Date("2025-01-01T00:00:00Z").getTime();
    const load = new Map<number, number>();
    expect(pickSlot(t0, load)).toBe(expectedT0);
  });
});
