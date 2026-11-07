import { describe, it, expect } from 'vitest';
import { isRainForecast, BMKG_RAIN_CODES, BMKG_MAPPING_TABLE } from '../src/bmkg';

describe('isRainForecast', () => {
  it('desc Hujan Ringan', () => expect(isRainForecast({ weatherDesc: 'Hujan Ringan' })).toBe(true));
  it('case-insensitive', () => expect(isRainForecast({ weatherDesc: 'hujan petir' })).toBe(true));
  it('Berawan', () => expect(isRainForecast({ weatherDesc: 'Berawan' })).toBe(false));
  it('code 63 desc null', () => expect(isRainForecast({ weatherCode: 63, weatherDesc: null })).toBe(true));
  it('code 3', () => expect(isRainForecast({ weatherCode: 3 })).toBe(false));
  it('code wins over desc', () =>
    expect(isRainForecast({ weatherDesc: 'Cerah', weatherCode: 95 })).toBe(true));
  it('table covers rain codes', () => {
    expect(BMKG_RAIN_CODES).toEqual([60, 61, 63, 80, 95, 97]);
    expect(BMKG_MAPPING_TABLE.filter((r) => r.rain).map((r) => r.code)).toEqual([...BMKG_RAIN_CODES]);
    expect(BMKG_MAPPING_TABLE.map((r) => r.code)).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5, 10, 45]));
  });
});
