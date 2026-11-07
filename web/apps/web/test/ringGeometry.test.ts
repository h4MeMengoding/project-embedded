import { describe, it, expect } from 'vitest';
import { ringGeometry } from '../src/lib/ringGeometry';

describe('ringGeometry', () => {
  it('72% -> 292 540', () => {
    const [len, total] = ringGeometry(72).dash.split(' ').map(Number);
    expect(Math.abs(len - 292)).toBeLessThanOrEqual(1);
    expect(total).toBe(540);
    expect(ringGeometry(72).track).toBe('405 540');
  });
  it('0, 100, out of range are finite and non-negative', () => {
    for (const p of [0, 100, -20, 250, NaN]) {
      const nums = ringGeometry(p).dash.split(' ').map(Number);
      nums.forEach((n) => {
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
      });
    }
    expect(Number(ringGeometry(250).dash.split(' ')[0])).toBeCloseTo(405, 5);
  });
});
