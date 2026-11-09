import { describe, it, expect } from 'vitest';
import { buildSamples, fitSemidiurnal, hourlyProfile, overallConfusion, rainOnsets, sampleBefore, type CalibRow } from '../src/calibration';
import { FUZZY_CONFIG_V2, FUZZY_CONFIG_V3, FUZZY_CONFIG_V1 } from '../src/fuzzyConfig';
import { runFuzzy } from '../src/fuzzy';

const MIN = 60_000;
const H = 3_600_000;
const T0 = Date.UTC(2026, 10, 1, 0, 0); // 07.00 WIB
const tide = (ms: number, a = 1, peak = 10) => a * Math.cos((2 * Math.PI * ((((ms + 7 * H + 30_000) % (24 * H)) / H) - peak)) / 12);

const series = (hours: number, o: { rh?: number; amp?: number; peak?: number; rain?: (t: number) => boolean; extraDrop?: (t: number) => number } = {}): CalibRow[] =>
  Array.from({ length: hours * 60 }, (_, i) => {
    const t = T0 + i * MIN;
    return {
      ts: new Date(t), tempDht: 24, humDht: o.rh ?? 93,
      pressureHpa: 985 + tide(t, o.amp ?? 1, o.peak ?? 10) - (o.extraDrop?.(t) ?? 0),
      rainWetSeconds: o.rain?.(t) ? 60 : 0,
    };
  });

describe('config v3', () => {
  it('beda dari v2 hanya di R16 (Tinggi -> Sedang), dan Tinggi hanya untuk tekanan Turun', () => {
    const diff = FUZZY_CONFIG_V3.rules.map((r, i) => (r.out !== FUZZY_CONFIG_V2.rules[i].out ? i + 1 : 0)).filter(Boolean);
    expect(diff).toEqual([16]);
    expect(FUZZY_CONFIG_V3.rules.filter((r) => r.out === 'Tinggi').every((r) => r.dp === 'Turun')).toBe(true);
    expect(FUZZY_CONFIG_V3.version).toBe('v3');
  });
  it('tekanan stabil, RH jenuh: v2 Tinggi, v3 Sedang', () => {
    const x = { deltaP3h: 0, rh: 93, dpd: 1.1 };
    expect(runFuzzy(x, FUZZY_CONFIG_V2).category).toBe('Tinggi');
    expect(runFuzzy(x, FUZZY_CONFIG_V3).category).toBe('Sedang');
  });
  it('v2 dan v3 identik di luar R16 (tekanan turun)', () => {
    const x = { deltaP3h: -1.5, rh: 93, dpd: 1.1 };
    expect(runFuzzy(x, FUZZY_CONFIG_V3).probability).toBe(runFuzzy(x, FUZZY_CONFIG_V2).probability);
  });
});

describe('kalibrasi', () => {
  const from = new Date(T0 + 4 * H);
  const to = new Date(T0 + 48 * H);
  const opts = { configs: [FUZZY_CONFIG_V2, FUZZY_CONFIG_V3], threshold: 50, minWetMinutes: 10 };

  it('malam jenuh tanpa hujan: v2 selalu alarm palsu, v3 tidak', () => {
    const s = buildSamples(series(51), from, to, opts);
    const prof = hourlyProfile(s, ['v2', 'v3']);
    expect(prof.every((h) => h.n > 0)).toBe(true);
    expect(prof.every((h) => Math.abs(h.dp!) < 0.05)).toBe(true); // koreksi menghapus variasi harian
    expect(prof.every((h) => h.far.v2 === 1 && h.far.v3 === 0)).toBe(true);
    expect(prof.every((h) => Math.abs(h.dpRaw!) > 0)).toBe(true);
    const cm = overallConfusion(s, ['v2', 'v3']);
    expect(cm.v2.fp).toBeGreaterThan(0);
    expect(cm.v3.fp).toBe(0);
  });
  it('label tidak memakai data setelah akhir periode', () => {
    const s = buildSamples(series(51), from, to, opts);
    expect(s.filter((x) => x.at.getTime() + 180 * MIN > to.getTime()).every((x) => x.actual === null)).toBe(true);
    expect(s.some((x) => x.actual === false)).toBe(true);
  });
  it('kejadian hujan: input 3 jam sebelumnya ditemukan', () => {
    const rainStart = T0 + 30 * H, rainEnd = rainStart + 40 * MIN;
    const rows = series(51, { rain: (t) => t >= rainStart && t < rainEnd, extraDrop: (t) => (t > rainStart - 3 * H ? Math.min(1.4, ((t - (rainStart - 3 * H)) / (3 * H)) * 1.4) : 0) });
    const on = rainOnsets(rows, 10);
    expect(on).toHaveLength(1);
    expect(on[0].wetMinutes).toBe(40);
    const s = buildSamples(rows, from, to, opts);
    const b = sampleBefore(s, on[0].start);
    expect(b).not.toBeNull();
    expect(b!.at.getTime()).toBe(rainStart - 180 * MIN);
    expect(b!.byVersion.v2).toBeDefined();
  });
  it('kejadian pendek (< minWet) diabaikan; celah ≤ 15 menit digabung', () => {
    const w = (a: number, b: number) => (t: number) => (t >= T0 + a * MIN && t < T0 + b * MIN);
    const rows = series(12, { rain: (t) => w(100, 106)(t) || w(200, 208)(t) || w(215, 222)(t) });
    const on = rainOnsets(rows, 10);
    expect(on).toHaveLength(1);
    expect(on[0].wetMinutes).toBe(15);
  });
  it('fitSemidiurnal memulihkan amplitudo dan puncak', () => {
    const f = fitSemidiurnal(series(72, { amp: 1.3, peak: 9.5 }))!;
    expect(f.amplitudeHpa).toBeCloseTo(1.3, 1);
    expect(f.peakHourWib).toBeCloseTo(9.5, 0);
    expect(fitSemidiurnal(series(12))).toBeNull();
  });
  it('v1 tanpa koreksi: ΔP3h teramati terbawa', () => {
    const s = buildSamples(series(51), from, to, { ...opts, configs: [FUZZY_CONFIG_V1] });
    expect(Math.max(...s.map((x) => Math.abs(x.dp)))).toBeGreaterThan(1);
  });
});
