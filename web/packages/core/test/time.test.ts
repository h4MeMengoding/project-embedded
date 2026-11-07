import { describe, it, expect } from 'vitest';
import { wibDayKey, formatWib } from '../src/time';

describe('time', () => {
  it('17:30Z is next WIB day', () =>
    expect(wibDayKey(new Date('2026-11-07T17:30:00Z'))).toBe('2026-11-08'));
  it('16:59Z is same WIB day', () =>
    expect(wibDayKey(new Date('2026-11-07T16:59:00Z'))).toBe('2026-11-07'));
  it('formats time with dot', () =>
    expect(formatWib(new Date('2026-11-07T13:57:00Z'), 'time')).toBe('20.57'));
});
