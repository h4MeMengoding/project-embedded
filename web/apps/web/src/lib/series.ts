const MIN = 60_000;
const H = 3_600_000;
const WIB_OFFSET = 7 * H;

export type SeriesRow = { t: number } & Record<string, number | null>;

/**
 * Rata-rata per bucket waktu pada grid yang rata dan sama untuk semua deret.
 * Bucket tanpa data diisi null sehingga garis terputus (celah), bukan disambung.
 */
export function bucketSeries(rows: SeriesRow[], keys: string[], from: number, to: number, maxPoints = 1200): SeriesRow[] {
  const bucket = Math.max(MIN, Math.ceil((to - from) / maxPoints / MIN) * MIN);
  const start = Math.floor(from / bucket) * bucket;
  const n = Math.max(1, Math.ceil((to - start) / bucket));
  const sum = keys.map(() => new Float64Array(n));
  const cnt = keys.map(() => new Uint32Array(n));
  for (const r of rows) {
    if (r.t < from || r.t >= to) continue;
    const i = Math.floor((r.t - start) / bucket);
    keys.forEach((k, j) => {
      const v = r[k];
      if (v != null && Number.isFinite(v)) { sum[j][i] += v; cnt[j][i]++; }
    });
  }
  return Array.from({ length: n }, (_, i) => {
    const o: SeriesRow = { t: start + i * bucket };
    keys.forEach((k, j) => { o[k] = cnt[j][i] ? sum[j][i] / cnt[j][i] : null; });
    return o;
  });
}

const STEPS_H = [1, 3, 6, 12, 24];

/** Tick jam bulat WIB sejajar slot BMKG (01.00, 04.00, ...), paling banyak maxTicks. */
export function timeTicks(from: number, to: number, maxTicks = 8): number[] {
  const spanH = (to - from) / H;
  const step = STEPS_H.find((s) => spanH / s <= maxTicks) ?? 24 * Math.ceil(spanH / 24 / maxTicks);
  const out: number[] = [];
  for (let h = Math.ceil((from + WIB_OFFSET) / H); ; h++) {
    const t = h * H - WIB_OFFSET;
    if (t > to) break;
    const hour = ((h % 24) + 24) % 24;
    const dayIdx = Math.floor(h / 24);
    const ok = step <= 24 ? (hour - 1 + 24) % step === 0 : hour === 1 && dayIdx % (step / 24) === 0;
    if (ok) out.push(t);
  }
  return out;
}

/** Tanggal (dd/mm WIB) hanya pada tick pertama atau saat hari berganti; bila tick harian, selalu. */
export function tickDayLabels(ticks: number[]): Map<number, string | null> {
  const day = (t: number) => new Date(t + WIB_OFFSET).toISOString().slice(8, 10) + '/' + new Date(t + WIB_OFFSET).toISOString().slice(5, 7);
  const daily = ticks.length > 1 && ticks[1] - ticks[0] >= 24 * H;
  const m = new Map<number, string | null>();
  ticks.forEach((t, i) => m.set(t, daily || i === 0 || day(t) !== day(ticks[i - 1]) ? day(t) : null));
  return m;
}

/** Domain dan tick bulat kelipatan `step` (dilipatgandakan bila terlalu banyak). */
export function niceAxis(values: (number | null)[], step: number, include: number[] = [], maxTicks = 8): { domain: [number, number]; ticks: number[] } | null {
  const v = [...values, ...include].filter((x): x is number => x != null && Number.isFinite(x));
  if (!v.length) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  let s = step;
  while (Math.ceil(hi / s) - Math.floor(lo / s) > maxTicks - 1) s *= 2;
  const a = Math.floor(lo / s) * s;
  const b = Math.max(Math.ceil(hi / s) * s, a + s);
  const ticks: number[] = [];
  for (let x = a; x <= b + s / 2; x += s) ticks.push(Math.round(x * 1e6) / 1e6);
  return { domain: [a, b], ticks };
}
