export const WINDOW_MS = 3 * 60 * 60 * 1000; // 3h
export const LOOKBACK_WINDOWS = 56; // 7 天 * 8 窗

// 归一到所在 3h 窗口起点（UTC，floor）。
export function windowStart(t: number): number {
  return Math.floor(t / WINDOW_MS) * WINDOW_MS;
}

// 从理论 renewAt 倒序挑最空闲窗口。
// load: Map<窗口起点ms, 已预约证书数>，覆盖 [T0 - 7天, T0]。
// 返回最终 renewAt（窗口起点 ms）。
export function pickSlot(
  theoreticalRenewAt: number,
  load: Map<number, number>,
): number {
  const t0 = windowStart(theoreticalRenewAt);
  let best = t0;
  let bestLoad = load.get(t0) ?? 0;
  for (let i = 1; i < LOOKBACK_WINDOWS; i++) {
    const w = t0 - i * WINDOW_MS;
    const l = load.get(w) ?? 0;
    if (l < bestLoad) {
      best = w;
      bestLoad = l;
    } // 严格小于 → 平局保留更晚(更接近 T0)
  }
  return best;
}
