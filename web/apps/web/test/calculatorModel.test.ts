import { describe, it, expect } from 'vitest';
import { buildCalculatorModel } from '../src/lib/calculatorModel';

describe('buildCalculatorModel', () => {
  it('active rules R5, R8, R14, R17', () => {
    const m = buildCalculatorModel({ deltaP3h: -0.9, rh: 87.5, dpd: 3 });
    expect(m.activeRules.map((r) => r.no)).toEqual(['R5', 'R8', 'R14', 'R17']);
    expect(m.activeRules.map((r) => r.strength)).toEqual([
      expect.closeTo(0.2, 10), expect.closeTo(0.3125, 10), expect.closeTo(0.1, 10), expect.closeTo(0.1, 10),
    ]);
  });
  it('derives dpd from temp', () => expect(buildCalculatorModel({ deltaP3h: 0, rh: 70, temp: 30 }).dpd).toBeCloseTo(6.07, 1));
  it('throws without temp and dpd', () => expect(() => buildCalculatorModel({ deltaP3h: 0, rh: 70 })).toThrow());
  it('throws on out-of-range RH', () => expect(() => buildCalculatorModel({ deltaP3h: 0, rh: 140, dpd: 3 })).toThrow());
});

import { runFuzzy, dewPointDepression } from '@ws/core';
describe('kalkulator = mesin fuzzy beranda', () => {
  it('masukan sama (ΔP +1,3; RH 86; suhu 25,4) memberi peluang dan kategori yang sama', () => {
    const m = buildCalculatorModel({ deltaP3h: 1.3, rh: 86, temp: 25.4 });
    const r = runFuzzy({ deltaP3h: 1.3, rh: 86, dpd: dewPointDepression(25.4, 86) });
    expect(m.result.probability).toBe(r.probability);
    expect(m.result.category).toBe(r.category);
  });
});
