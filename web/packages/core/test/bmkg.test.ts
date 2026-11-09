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

import { readFileSync } from 'node:fs';
import { parseBmkg } from '../src/bmkg';

describe('parseBmkg (respons asli Pakintelan 2026-11-09)', () => {
  const json = JSON.parse(readFileSync(new URL('./fixtures/bmkg-33.74.12.1001.json', import.meta.url), 'utf8'));
  const r = parseBmkg(json);
  it('lokasi', () => {
    expect(r.location.adm4).toBe('33.74.12.1001');
    expect(r.location.desa).toBe('Pakintelan');
    expect(r.location.kecamatan).toBe('Gunungpati');
    expect(r.location.kotkab).toBe('Kota Semarang');
  });
  it('semua slot diratakan', () => expect(r.forecasts).toHaveLength(17));
  it('waktu UTC', () => {
    const f = r.forecasts[0];
    expect(f.utcDatetime.toISOString()).toBe('2026-11-09T14:00:00.000Z');
    expect(f.analysisDate.toISOString()).toBe('2026-11-09T12:00:00.000Z');
    expect(f.localDatetime).toBe('2026-11-09 21:00:00');
  });
  it('field cuaca', () => {
    const f = r.forecasts[0];
    expect(f).toMatchObject({ t: 25, hu: 88, weatherCode: 2, weatherDesc: 'Cerah Berawan', tcc: 81, ws: 3.1, wd: 'SW' });
  });
  it('urut naik dan unik', () => {
    const t = r.forecasts.map((f) => f.utcDatetime.getTime());
    expect([...t].sort((a, b) => a - b)).toEqual(t);
    expect(new Set(t).size).toBe(t.length);
  });
  it('semua kode fixture dikenal', () => expect(r.unknown).toEqual([]));
  it('struktur asing melempar', () => {
    expect(() => parseBmkg({})).toThrow('Respons BMKG tidak dikenali');
    expect(() => parseBmkg({ data: [{ cuaca: 'x' }] })).toThrow('Respons BMKG tidak dikenali');
  });
});
