/** Rata-ratakan per bucket agar maksimal maxPoints titik; null diabaikan. */
export function downsample<T extends { t: number }>(rows: T[], keys: (keyof T)[], maxPoints = 1000): T[] {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += step) {
    const b = rows.slice(i, i + step);
    const o = { t: b[0].t } as Record<string, unknown>;
    for (const k of keys) {
      const v = b.map((r) => r[k] as unknown as number | null).filter((x): x is number => x != null);
      o[k as string] = v.length ? v.reduce((a, c) => a + c, 0) / v.length : null;
    }
    out.push(o as T);
  }
  return out;
}
