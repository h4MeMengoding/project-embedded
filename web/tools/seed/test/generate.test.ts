import { describe, it, expect } from 'vitest';
import { generateSeries, generateBmkg } from '../src/generate';

const end = new Date('2026-11-07T13:57:30Z');
const base = { end, days: 7, seed: 42, scenario: 'normal' as const };

describe('generateSeries', () => {
  it('is deterministic for same seed', () => {
    expect(generateSeries(base)).toEqual(generateSeries(base));
  });
  it('differs for another seed', () => {
    expect(generateSeries({ ...base, seed: 43 }).minutes).not.toEqual(generateSeries(base).minutes);
  });
  it('last minute <= end, wet seconds in 0..60', () => {
    const { minutes } = generateSeries(base);
    expect(minutes.length).toBeGreaterThan(7 * 1440 * 0.8);
    expect(Math.max(...minutes.map((m) => m.ts.getTime()))).toBeLessThanOrEqual(end.getTime());
    for (const m of minutes) {
      expect(m.rainWetSeconds).toBeGreaterThanOrEqual(0);
      expect(m.rainWetSeconds).toBeLessThanOrEqual(60);
    }
  });
  it('normal has backfill gap and rain events', () => {
    const r = generateSeries(base);
    expect(r.backfillRanges.length).toBeGreaterThan(0);
    expect(r.minutes.some((m) => m.isBackfill)).toBe(true);
    expect(r.rainEvents.length).toBeGreaterThan(0);
  });
  it('insufficient scenario has < 3h of data', () => {
    const { minutes } = generateSeries({ ...base, scenario: 'insufficient' });
    const ts = minutes.map((m) => m.ts.getTime());
    expect((Math.max(...ts) - Math.min(...ts)) / 60000).toBeLessThan(180);
  });
  it('offline scenario ends >= 10 min before end', () => {
    const { minutes } = generateSeries({ ...base, scenario: 'offline' });
    const last = Math.max(...minutes.map((m) => m.ts.getTime()));
    expect((end.getTime() - last) / 60000).toBeGreaterThanOrEqual(10);
  });
});

describe('generateBmkg', () => {
  const rows = generateBmkg({ from: new Date(end.getTime() - 7 * 86400000), days: 10, scenario: 'normal' });
  it('is synthetic', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.adm4).toBe('SEED');
      expect((r.raw as { synthetic: boolean }).synthetic).toBe(true);
    }
  });
  it('covers end up to 3 days ahead', () => {
    const us = rows.map((r) => r.utcDatetime.getTime());
    expect(Math.min(...us)).toBeLessThanOrEqual(end.getTime());
    expect(Math.max(...us)).toBeGreaterThanOrEqual(end.getTime() + 3 * 86400000 - 3 * 3600000);
  });
  it('disagree scenario inverts rain', () => {
    const a = generateBmkg({ from: end, days: 3, scenario: 'normal' });
    const b = generateBmkg({ from: end, days: 3, scenario: 'disagree' });
    expect(a.map((r) => r.weatherDesc)).not.toEqual(b.map((r) => r.weatherDesc));
  });
});

describe('fase tekanan tropis', () => {
  it('maksimum ~10.00/22.00 WIB dan minimum ~04.00/16.00 WIB', () => {
    const { minutes } = generateSeries({ end: new Date('2026-11-07T17:00:00Z'), days: 5, seed: 42, scenario: 'normal' });
    const sum = new Array(24).fill(0), n = new Array(24).fill(0);
    for (const m of minutes) {
      const h = new Date(m.ts.getTime() + 7 * 3600_000).getUTCHours();
      sum[h] += m.pressureHpa; n[h]++;
    }
    const avg = sum.map((s, i) => s / n[i]);
    const arg = (hs: number[], max: boolean) => hs.reduce((best, h) => ((max ? avg[h % 24] > avg[best % 24] : avg[h % 24] < avg[best % 24]) ? h : best), hs[0]) % 24;
    expect(Math.abs(arg([7, 8, 9, 10, 11, 12], true) - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(arg([19, 20, 21, 22, 23, 24], true) - 22)).toBeLessThanOrEqual(1);
    expect(Math.abs(arg([2, 3, 4, 5, 6], false) - 4)).toBeLessThanOrEqual(1);
    // minimum sore dipercepat oleh penurunan tekanan pra-hujan konvektif (14.00-16.00)
    expect(arg([13, 14, 15, 16, 17], false)).toBeGreaterThanOrEqual(14);
    expect(arg([13, 14, 15, 16, 17], false)).toBeLessThanOrEqual(16);
  });
});
