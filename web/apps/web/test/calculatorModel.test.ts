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
