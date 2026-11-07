export type Scenario = 'normal' | 'offline' | 'insufficient' | 'disagree';

export type MinuteSeed = {
  ts: Date;
  tempDht: number;
  humDht: number;
  tempBmp: number;
  pressureHpa: number;
  lux: number;
  rainAnalogAvg: number;
  rainWetSeconds: number;
  samples: number;
  isBackfill: boolean;
  receivedAt: Date;
};
export type RainEventSeed = { ts: Date; state: 'start' | 'stop'; isBackfill: boolean };
export type BmkgSeed = {
  adm4: string;
  analysisDate: Date;
  utcDatetime: Date;
  localDatetime: string;
  t: number;
  hu: number;
  weatherCode: number;
  weatherDesc: string;
  tcc: number;
  ws: number;
  wd: string;
  raw: { synthetic: true };
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Hash deterministik -> [0,1). */
function h01(...n: number[]): number {
  let h = 2166136261;
  for (const x of n) {
    h ^= Math.floor(x) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

const utcDay = (t: number) => Math.floor(t / DAY);
/** Hari berbadai: dipakai bersama oleh deret sensor dan prakiraan BMKG sintetis. */
const stormy = (day: number) => h01(day, 7919) < 0.6;

type Episode = { start: number; end: number };
function episodesFor(fromMs: number, toMs: number, seed: number): Episode[] {
  const out: Episode[] = [];
  for (let d = utcDay(fromMs) - 1; d <= utcDay(toMs); d++) {
    if (!stormy(d)) continue;
    const startH = 6 + h01(d, seed, 1) * 3.5; // 13.00-16.30 WIB
    const durMin = 30 + h01(d, seed, 2) * 70;
    const start = d * DAY + startH * HOUR;
    out.push({ start, end: start + durMin * MIN });
  }
  return out;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export function generateSeries(opts: { end: Date; days: number; seed: number; scenario: Scenario }): {
  minutes: MinuteSeed[];
  rainEvents: RainEventSeed[];
  backfillRanges: { start: Date; end: Date }[];
} {
  const { end, days, seed, scenario } = opts;
  const last = Math.floor(end.getTime() / MIN) * MIN - MIN;
  let first = Math.ceil((end.getTime() - days * DAY) / MIN) * MIN;
  if (scenario === 'insufficient') first = last - 150 * MIN;
  const eps = episodesFor(first, last, seed);

  // celah: A terisi backfill, B hilang permanen, C terisi backfill
  const gaps =
    scenario === 'insufficient'
      ? []
      : [
          { s: last - 4 * DAY + 3 * HOUR, e: last - 4 * DAY + 3 * HOUR + 25 * MIN, backfill: true },
          { s: last - 2 * DAY + 5 * HOUR, e: last - 2 * DAY + 5 * HOUR + 40 * MIN, backfill: false },
          { s: last - 1 * DAY + 9 * HOUR, e: last - 1 * DAY + 9 * HOUR + 12 * MIN, backfill: true },
        ].filter((g) => g.s >= first);
  const offlineCut = scenario === 'offline' ? last - 25 * MIN : Infinity;

  const minutes: MinuteSeed[] = [];
  const wet: { t: number; isWet: boolean }[] = [];
  for (let t = first; t <= last; t += MIN) {
    const wibH = ((t / HOUR + 7) % 24 + 24) % 24;
    const inStorm = eps.find((e) => t >= e.start && t < e.end);
    const edge = inStorm && (t < inStorm.start + 3 * MIN || t >= inStorm.end - 3 * MIN);
    const wetSeconds = inStorm ? (edge ? Math.round(30 + h01(t, seed, 3) * 30) : 60) : 0;
    const nextStart = eps.find((e) => e.start > t && e.start - t <= 3 * HOUR);
    const pre = nextStart ? 1 - (nextStart.start - t) / (3 * HOUR) : 0;
    const raining = !!inStorm;

    const temp = 27.5 + 4.5 * Math.sin((2 * Math.PI * (wibH - 9)) / 24) - (raining ? 3 : 0) + (h01(t, seed, 4) - 0.5) * 0.4;
    const hum = clamp(82 - 3.5 * (temp - 27.5) + (raining ? 12 : 0) + (h01(t, seed, 5) - 0.5) * 3, 40, 100);
    const pressure =
      985 + 1.5 * Math.sin((2 * Math.PI * (t / HOUR - 4)) / 12) - 1.4 * pre + (h01(t, seed, 6) - 0.5) * 0.2;
    const daylight = wibH >= 6 && wibH < 18 ? Math.sin((Math.PI * (wibH - 6)) / 12) : 0;
    const lux = Math.round(Math.max(0, 60000 * daylight * (raining ? 0.2 : 1) * (0.9 + h01(t, seed, 7) * 0.2)));
    const analog = raining ? 1200 + h01(t, seed, 8) * 400 : 3900 + (h01(t, seed, 9) - 0.5) * 300;

    wet.push({ t, isWet: wetSeconds >= 30 });
    if (t > offlineCut) continue;
    const gap = gaps.find((g) => t >= g.s && t < g.e);
    if (gap && !gap.backfill) continue;
    const isBackfill = !!gap;
    minutes.push({
      ts: new Date(t),
      tempDht: r1(temp),
      humDht: r1(hum),
      tempBmp: r1(temp + 0.4),
      pressureHpa: r2(pressure),
      lux,
      rainAnalogAvg: Math.round(analog),
      rainWetSeconds: wetSeconds,
      samples: 6,
      isBackfill,
      receivedAt: new Date(isBackfill ? (gap as { e: number }).e + 2 * MIN : t + MIN + 2000 + Math.floor(h01(t, seed, 10) * 5000)),
    });
  }

  const backfillSet = new Set(minutes.filter((m) => m.isBackfill).map((m) => m.ts.getTime()));
  const rainEvents: RainEventSeed[] = [];
  for (let i = 0; i < wet.length; i++) {
    const prev = i > 0 ? wet[i - 1].isWet : false;
    if (wet[i].isWet !== prev && wet[i].t <= offlineCut) {
      rainEvents.push({
        ts: new Date(wet[i].t + 30_000),
        state: wet[i].isWet ? 'start' : 'stop',
        isBackfill: backfillSet.has(wet[i].t),
      });
    }
  }
  const backfillRanges = gaps.filter((g) => g.backfill).map((g) => ({ start: new Date(g.s), end: new Date(g.e) }));
  return { minutes, rainEvents, backfillRanges };
}

const DRY = [
  { code: 0, desc: 'Cerah' },
  { code: 1, desc: 'Cerah Berawan' },
  { code: 3, desc: 'Berawan' },
];

export function generateBmkg(opts: { from: Date; days: number; scenario: Scenario; now?: Date }): BmkgSeed[] {
  const { from, days, scenario } = opts;
  const toMs = from.getTime() + days * DAY;
  const nowMs = (opts.now ?? new Date(toMs)).getTime();
  const step = 3 * HOUR;
  const firstT = Math.floor(from.getTime() / step) * step;
  const out: BmkgSeed[] = [];
  for (let t = firstT; t < toMs; t += step) {
    const hourUtc = (t % DAY) / HOUR;
    const stormSlot = stormy(utcDay(t)) && (hourUtc === 6 || hourUtc === 9);
    const rainy = scenario === 'disagree' ? !stormSlot && (hourUtc === 6 || hourUtc === 9) : stormSlot;
    const dry = DRY[Math.floor(h01(t, 11) * DRY.length)];
    const w = rainy ? { code: 60, desc: 'Hujan Ringan' } : dry;
    const wib = new Date(t + 7 * HOUR).toISOString().slice(0, 19).replace('T', ' ');
    const wibH = (hourUtc + 7) % 24;
    for (let a = Math.floor((from.getTime() - 3 * DAY) / (12 * HOUR)) * 12 * HOUR; a <= nowMs; a += 12 * HOUR) {
      if (a >= t || t - a > 3 * DAY) continue;
      out.push({
        adm4: 'SEED',
        analysisDate: new Date(a),
        utcDatetime: new Date(t),
        localDatetime: wib,
        t: r1(27.5 + 4 * Math.sin((2 * Math.PI * (wibH - 9)) / 24)),
        hu: rainy ? 92 : 78,
        weatherCode: w.code,
        weatherDesc: w.desc,
        tcc: rainy ? 90 : 40,
        ws: 6,
        wd: 'W',
        raw: { synthetic: true },
      });
    }
  }
  return out;
}
