import { describe, it, expect } from 'vitest';
import { trap, tri, runFuzzy, isPredictRain } from '../src/fuzzy';
import { FUZZY_CONFIG_V1 } from '../src/fuzzyConfig';

describe('membership', () => {
  it('trap rising edge', () => {
    const f = trap(0.3, 1.5, 10, 10);
    expect(f(0.3)).toBe(0);
    expect(f(1.5)).toBe(1);
    expect(f(0.9)).toBeCloseTo(0.5, 10);
    expect(f(10)).toBe(1);
  });
  it('tri', () => {
    const f = tri(-1, 0, 1);
    expect(f(-1)).toBe(0);
    expect(f(0)).toBe(1);
    expect(f(1)).toBe(0);
    expect(f(0.5)).toBeCloseTo(0.5, 10);
    expect(f(-0.5)).toBeCloseTo(0.5, 10);
  });
  it('config trap shoulder at -50 is 1 (clamp)', () => {
    const r = runFuzzy({ deltaP3h: -50, rh: 50, dpd: 5 });
    expect(r.memberships.dp.Turun).toBe(1);
  });
});

describe('runFuzzy manual cases', () => {
  it('config has 27 rules', () => expect(FUZZY_CONFIG_V1.rules).toHaveLength(27));
  it('R14 only', () => {
    const r = runFuzzy({ deltaP3h: 0, rh: 77.5, dpd: 4 });
    expect(r.ruleStrengths[13]).toBe(1);
    expect(r.ruleStrengths.filter((s) => s > 0)).toHaveLength(1);
    expect(r.probability).toBeCloseTo(50, 0);
    expect(r.category).toBe('Sedang');
  });
  it('R16 Tinggi', () => {
    const r = runFuzzy({ deltaP3h: 0, rh: 100, dpd: 0 });
    expect(r.ruleStrengths[15]).toBe(1);
    expect(r.probability).toBeCloseTo(84.44, 0);
    expect(r.category).toBe('Tinggi');
  });
  it('R7 Tinggi', () => {
    const r = runFuzzy({ deltaP3h: -2, rh: 93, dpd: 1 });
    expect(r.ruleStrengths[6]).toBe(1);
    expect(r.probability).toBeCloseTo(84.44, 0);
    expect(r.category).toBe('Tinggi');
  });
  it('R21 Rendah', () => {
    const r = runFuzzy({ deltaP3h: 2, rh: 40, dpd: 10 });
    expect(r.ruleStrengths[20]).toBe(1);
    expect(r.probability).toBeCloseTo(15.56, 0);
    expect(r.category).toBe('Rendah');
  });
  it('mixed activation', () => {
    const r = runFuzzy({ deltaP3h: -0.9, rh: 87.5, dpd: 3 });
    const s = r.ruleStrengths;
    expect(s[4]).toBeCloseTo(0.2, 10);
    expect(s[7]).toBeCloseTo(0.3125, 10);
    expect(s[13]).toBeCloseTo(0.1, 10);
    expect(s[16]).toBeCloseTo(0.1, 10);
    s.forEach((v, i) => {
      if (![4, 7, 13, 16].includes(i)) expect(v).toBe(0);
    });
    expect(r.aggregated.x).toHaveLength(201);
  });
  it('no rules fired', () => {
    const r = runFuzzy({ deltaP3h: 0, rh: 50, dpd: 5 }, { ...FUZZY_CONFIG_V1, rules: [] });
    expect(r.probability).toBe(0);
    expect(r.noRuleFired).toBe(true);
  });
});

describe('isPredictRain', () => {
  it('threshold', () => {
    expect(isPredictRain(50)).toBe(true);
    expect(isPredictRain(49.9)).toBe(false);
    expect(isPredictRain(60, 70)).toBe(false);
  });
});
