import { describe, it, expect } from 'vitest';
import { dewPoint, dewPointDepression } from '../src/meteo';

describe('meteo', () => {
  it('dewPoint(30,70) ~ 23.9', () => expect(dewPoint(30, 70)).toBeCloseTo(23.9, 1));
  it('dewPoint(25,100) ~ 25', () => expect(dewPoint(25, 100)).toBeCloseTo(25, 1));
  it('clamps RH 0 and 150', () => {
    expect(Number.isFinite(dewPoint(25, 0))).toBe(true);
    expect(Number.isFinite(dewPoint(25, 150))).toBe(true);
    expect(dewPoint(25, 150)).toBeCloseTo(dewPoint(25, 100), 6);
  });
  it('dpd = T - Td', () =>
    expect(dewPointDepression(30, 70)).toBeCloseTo(30 - dewPoint(30, 70), 10));
});
