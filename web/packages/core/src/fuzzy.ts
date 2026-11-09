import { dewPoint } from './meteo';
import { ACTIVE_FUZZY_CONFIG, type FuzzyConfig, type Level3, type Shape } from './fuzzyConfig';

export const trap = (a: number, b: number, c: number, d: number) => (x: number): number => {
  if (x < a || x > d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return b === a ? 1 : (x - a) / (b - a);
  return d === c ? 1 : (d - x) / (d - c);
};

export const tri = (a: number, b: number, c: number) => (x: number): number => {
  if (x <= a || x >= c) return 0;
  return x <= b ? (x - a) / (b - a) : (c - x) / (c - b);
};

const evalShape = (s: Shape, x: number): number =>
  s.kind === 'trap' ? trap(...s.p)(x) : tri(...s.p)(x);

const clamp = (x: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, x));

export type FuzzyInput = { deltaP3h: number; rh: number; dpd: number };
export type FuzzyResult = {
  configVersion: string;
  inputs: FuzzyInput;
  memberships: { dp: Record<string, number>; rh: Record<string, number>; dpd: Record<string, number> };
  ruleStrengths: number[];
  clipped: Record<Level3, number>;
  aggregated: { x: number[]; mu: number[] };
  probability: number;
  category: Level3;
  noRuleFired: boolean;
};

const LEVELS: Level3[] = ['Rendah', 'Sedang', 'Tinggi'];

function fuzzify(sets: Record<string, Shape>, x: number) {
  return Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, evalShape(s, x)]));
}

export function runFuzzy(input: FuzzyInput, config: FuzzyConfig = ACTIVE_FUZZY_CONFIG): FuzzyResult {
  const u = config.universe;
  const dpx = clamp(input.deltaP3h, u.dp);
  const rhx = clamp(input.rh, u.rh);
  const dpdx = clamp(input.dpd, u.dpd);
  const memberships = {
    dp: fuzzify(config.dp, dpx),
    rh: fuzzify(config.rh, rhx),
    dpd: fuzzify(config.dpd, dpdx),
  };
  const ruleStrengths = config.rules.map((r) =>
    Math.min(memberships.dp[r.dp], memberships.rh[r.rh], memberships.dpd[r.dpd]),
  );
  const clipped: Record<Level3, number> = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  config.rules.forEach((r, i) => {
    clipped[r.out] = Math.max(clipped[r.out], ruleStrengths[i]);
  });
  const x: number[] = [];
  const mu: number[] = [];
  for (let i = 0; i <= 200; i++) {
    const xi = i * 0.5;
    x.push(xi);
    mu.push(Math.max(...LEVELS.map((l) => Math.min(clipped[l], evalShape(config.out[l], xi)))));
  }
  const area = mu.reduce((a, b) => a + b, 0);
  const noRuleFired = area === 0;
  const probability = noRuleFired ? 0 : x.reduce((a, xi, i) => a + xi * mu[i], 0) / area;
  const category = LEVELS.reduce((best, l) =>
    evalShape(config.out[l], probability) > evalShape(config.out[best], probability) ? l : best,
  );
  return {
    configVersion: config.version,
    inputs: input,
    memberships,
    ruleStrengths,
    clipped,
    aggregated: { x, mu },
    probability,
    category,
    noRuleFired,
  };
}

/** Keputusan biner v2: peluang dibulatkan 1 desimal, lalu hujan bila lebih besar dari ambang. */
export const isPredictRain = (probability: number, threshold = 50): boolean =>
  Math.round(probability * 10) / 10 > threshold;

export type MinuteRow = {
  ts: Date;
  tempDht: number | null;
  humDht: number | null;
  pressureHpa: number | null;
};
export type WindowInputs =
  | { status: 'ok'; deltaP3h: number; deltaP3hRaw: number; tideCorrection: number; rh: number; temp: number; dewPoint: number; dpd: number }
  | { status: 'insufficient_data' };

const MIN = 60_000;
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;


/** Jendela 10 menit yang berakhir pada `end`: ts di (end-10m, end]. */
function windowRows(rows: MinuteRow[], end: Date): MinuteRow[] {
  const e = end.getTime();
  return rows.filter((r) => r.ts.getTime() > e - 10 * MIN && r.ts.getTime() <= e);
}

const H = 3_600_000;
const tideAt = (ms: number, t: { amplitudeHpa: number; peakHourWib: number }) =>
  t.amplitudeHpa * Math.cos((2 * Math.PI * ((((ms + 7 * H) % (24 * H)) / H) - t.peakHourWib)) / 12);

/**
 * Perubahan tekanan 3 jam yang diharapkan dari variasi harian. Pusat jendela data 10 menit
 * yang berakhir pada `at` adalah at − 4 menit (rata-rata awal menit + 30 dtk).
 */
export function tideDelta3h(at: Date, tide: { amplitudeHpa: number; peakHourWib: number }): number {
  const c = at.getTime() - 4 * MIN;
  return tideAt(c, tide) - tideAt(c - 3 * H, tide);
}

export function computeWindowInputs(rows: MinuteRow[], at: Date, config: FuzzyConfig = ACTIVE_FUZZY_CONFIG): WindowInputs {
  const now = windowRows(rows, at);
  const prev = windowRows(rows, new Date(at.getTime() - 180 * MIN));
  const pNow = now.filter((r) => r.pressureHpa != null).map((r) => r.pressureHpa as number);
  const pPrev = prev.filter((r) => r.pressureHpa != null).map((r) => r.pressureHpa as number);
  const rhs = now.filter((r) => r.humDht != null).map((r) => r.humDht as number);
  const temps = now.filter((r) => r.tempDht != null).map((r) => r.tempDht as number);
  if (pNow.length < 5 || pPrev.length < 5 || rhs.length === 0 || temps.length === 0) {
    return { status: 'insufficient_data' };
  }
  const rh = avg(rhs);
  const temp = avg(temps);
  const td = dewPoint(temp, rh);
  const deltaP3hRaw = avg(pNow) - avg(pPrev);
  const tideCorrection = config.pressureTide ? tideDelta3h(at, config.pressureTide) : 0;
  return { status: 'ok', deltaP3h: deltaP3hRaw - tideCorrection, deltaP3hRaw, tideCorrection, rh, temp, dewPoint: td, dpd: temp - td };
}
