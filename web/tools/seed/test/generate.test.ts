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
