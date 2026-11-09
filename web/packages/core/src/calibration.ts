import { computeWindowInputs, isPredictRain, runFuzzy, type MinuteRow } from './fuzzy';
import type { FuzzyConfig } from './fuzzyConfig';
import { confusion, type Confusion } from './evaluation';

const MIN = 60_000;
const H = 3_600_000;
const WIB = 7 * H;

export type CalibRow = MinuteRow & { rainWetSeconds: number | null };
export type CalibSample = {
  at: Date;
  hourWib: number;
  temp: number;
  rh: number;
  dpd: number;
  dp: number; // ΔP3h terkoreksi (masukan fuzzy, config pertama)
  dpRaw: number;
  byVersion: Record<string, { prob: number; rain: boolean }>;
  /** Hujan pada 3 jam berikutnya; null bila data tidak cukup atau jendela label melewati batas periode. */
  actual: boolean | null;
};

const hourWib = (ms: number) => Math.floor((((ms + WIB) % (24 * H)) + 24 * H) % (24 * H) / H);

/**
 * Sampel per menit di [from, to): masukan fuzzy dan keluaran tiap config. Label aktual memakai data 3 jam
 * berikutnya, tetapi hanya bila jendela label berakhir ≤ to, agar tidak membocorkan data di luar periode.
 */
export function buildSamples(
  input: CalibRow[], from: Date, to: Date,
  o: { configs: FuzzyConfig[]; threshold: number; minWetMinutes: number },
): CalibSample[] {
  const rows = input.slice().sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const wet = new Map<number, boolean>();
  for (const r of rows) wet.set(r.ts.getTime(), (r.rainWetSeconds ?? 0) >= 30);
  const out: CalibSample[] = [];
  let lo = 0;
  for (let i = 0; i < rows.length; i++) {
    const at = rows[i].ts;
    const t = at.getTime();
    while (rows[lo].ts.getTime() < t - 191 * MIN) lo++;
    if (t < from.getTime() || t >= to.getTime()) continue;
    const win = rows.slice(lo, i + 1);
    const byVersion: CalibSample['byVersion'] = {};
    let first: ReturnType<typeof computeWindowInputs> | null = null;
    let ok = true;
    for (const c of o.configs) {
      const w = computeWindowInputs(win, at, c);
      if (w.status !== 'ok') { ok = false; break; }
      first ??= w;
      const r = runFuzzy({ deltaP3h: w.deltaP3h, rh: w.rh, dpd: w.dpd }, c);
      byVersion[c.version] = { prob: r.probability, rain: isPredictRain(r.probability, o.threshold) };
    }
    if (!ok || !first || first.status !== 'ok') continue;
    let actual: boolean | null = null;
    if (t + 180 * MIN <= to.getTime()) {
      let n = 0, w = 0;
      for (let k = 1; k <= 180; k++) {
        const v = wet.get(t + k * MIN);
        if (v === undefined) continue;
        n++;
        if (v) w++;
      }
      actual = n < 144 ? null : w >= o.minWetMinutes;
    }
    out.push({ at, hourWib: hourWib(t), temp: first.temp, rh: first.rh, dpd: first.dpd, dp: first.deltaP3h, dpRaw: first.deltaP3hRaw, byVersion, actual });
  }
  return out;
}

export type HourStat = {
  hour: number;
  n: number;
  rh: number | null;
  dpd: number | null;
  dp: number | null;
  dpRaw: number | null;
  noRain: number;
  rain: number;
  meanProb: Record<string, number | null>;
  /** Laju alarm palsu = FP / (FP + TN) pada menit tanpa hujan 3 jam berikutnya. */
  far: Record<string, number | null>;
  recall: Record<string, number | null>;
};

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

export function hourlyProfile(samples: CalibSample[], versions: string[]): HourStat[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const s = samples.filter((x) => x.hourWib === hour);
    const lab = s.filter((x) => x.actual != null);
    const neg = lab.filter((x) => !x.actual);
    const pos = lab.filter((x) => x.actual);
    const rate = (xs: CalibSample[], v: string) => (xs.length ? xs.filter((x) => x.byVersion[v].rain).length / xs.length : null);
    return {
      hour, n: s.length,
      rh: mean(s.map((x) => x.rh)), dpd: mean(s.map((x) => x.dpd)), dp: mean(s.map((x) => x.dp)), dpRaw: mean(s.map((x) => x.dpRaw)),
      noRain: neg.length, rain: pos.length,
      meanProb: Object.fromEntries(versions.map((v) => [v, mean(s.map((x) => x.byVersion[v].prob))])),
      far: Object.fromEntries(versions.map((v) => [v, rate(neg, v)])),
      recall: Object.fromEntries(versions.map((v) => [v, rate(pos, v)])),
    };
  });
}

export function overallConfusion(samples: CalibSample[], versions: string[]): Record<string, Confusion> {
  return Object.fromEntries(versions.map((v) => [v, confusion(samples.map((x) => ({ actual: x.actual, predicted: x.byVersion[v].rain })))]));
}

export type RainOnset = { start: Date; end: Date; wetMinutes: number };

/** Kejadian hujan: menit basah (≥ 30 dtk) yang berjarak ≤ gapMin digabung; dipakai bila menit basahnya ≥ minWet. */
export function rainOnsets(rows: CalibRow[], minWet: number, gapMin = 15): RainOnset[] {
  const wet = rows.filter((r) => (r.rainWetSeconds ?? 0) >= 30).map((r) => r.ts.getTime()).sort((a, b) => a - b);
  const out: RainOnset[] = [];
  for (const t of wet) {
    const last = out[out.length - 1];
    if (last && t - last.end.getTime() <= gapMin * MIN) { last.end = new Date(t); last.wetMinutes++; }
    else out.push({ start: new Date(t), end: new Date(t), wetMinutes: 1 });
  }
  return out.filter((e) => e.wetMinutes >= minWet);
}

/** Sampel terdekat dengan `leadMin` menit sebelum awal kejadian (toleransi tolMin); null bila tidak ada. */
export function sampleBefore(samples: CalibSample[], onset: Date, leadMin = 180, tolMin = 5): CalibSample | null {
  const target = onset.getTime() - leadMin * MIN;
  let best: CalibSample | null = null;
  for (const s of samples) {
    const d = Math.abs(s.at.getTime() - target);
    if (d <= tolMin * MIN && (!best || d < Math.abs(best.at.getTime() - target))) best = s;
  }
  return best;
}

export type TideFit = { amplitudeHpa: number; peakHourWib: number; trendHpaPerDay: number; n: number; spanHours: number };

/** Regresi kuadrat terkecil P = c + b·t + a1·cos θ + a2·sin θ, θ = 2π·(jam WIB)/12. Butuh rentang ≥ 24 jam. */
export function fitSemidiurnal(rows: MinuteRow[]): TideFit | null {
  const d = rows.filter((r) => r.pressureHpa != null).sort((a, b) => a.ts.getTime() - b.ts.getTime());
  if (d.length < 600) return null;
  const t0 = d[0].ts.getTime();
  const span = (d[d.length - 1].ts.getTime() - t0) / H;
  if (span < 24) return null;
  const A = Array.from({ length: 4 }, () => new Array(5).fill(0)); // matriks normal + sisi kanan
  for (const r of d) {
    const ms = r.ts.getTime() + 30_000;
    const th = (2 * Math.PI * ((((ms + WIB) % (24 * H)) / H) % 12)) / 12;
    const f = [1, (ms - t0) / (24 * H), Math.cos(th), Math.sin(th)];
    const y = r.pressureHpa as number;
    for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) A[i][j] += f[i] * f[j]; A[i][4] += f[i] * y; }
  }
  for (let c = 0; c < 4; c++) { // eliminasi Gauss dengan pivot parsial
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let j = c; j < 5; j++) A[r][j] -= k * A[c][j];
    }
  }
  const x = A.map((row, i) => row[4] / row[i]);
  const [, trend, a1, a2] = x;
  const peak = ((Math.atan2(a2, a1) * 12) / (2 * Math.PI) + 12) % 12;
  return { amplitudeHpa: Math.hypot(a1, a2), peakHourWib: peak, trendHpaPerDay: trend, n: d.length, spanHours: span };
}
