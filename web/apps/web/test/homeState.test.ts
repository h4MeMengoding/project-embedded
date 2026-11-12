import { describe, it, expect } from 'vitest';
import { deriveHomeState, type HomeInput } from '../src/lib/homeState';

const now = new Date('2026-11-07T13:57:00Z');
const reading = (o: Partial<NonNullable<HomeInput['reading']>> = {}) => ({
  ts: now, tempDht: 27.4, humDht: 81, pressureHpa: 985.3, lux: 12450, rainWetSeconds: 0, ...o,
});
const pred = (o: Partial<NonNullable<HomeInput['prediction']>> = {}) => ({
  ts: now, status: 'ok', probability: 72, category: 'Tinggi', predictRain: true, ...o,
});
const device = (o: Partial<HomeInput['device']> = {}) => ({ online: true, lastSeenAt: now, ...o });
const base: HomeInput = { reading: reading(), prediction: pred(), bmkgNow: { weatherCode: 60, weatherDesc: 'Hujan Ringan' }, device: device(), threshold: 50 };

describe('deriveHomeState', () => {
  it('empty when nothing at all', () =>
    expect(deriveHomeState({ reading: null, prediction: null, bmkgNow: null, device: { online: false, lastSeenAt: null }, threshold: 50 }).kind).toBe('empty'));
  it('insufficient', () => {
    const s = deriveHomeState({ ...base, prediction: pred({ status: 'insufficient_data', probability: null, category: null, predictRain: null }) });
    expect(s).toMatchObject({ kind: 'insufficient', percent: null, headline: 'Menunggu 3 jam data tekanan', agreement: null });
  });
  it('offline keeps last values with label', () => {
    const s = deriveHomeState({ ...base, device: device({ online: false }) });
    expect(s.kind).toBe('offline');
    if (s.kind !== 'empty') {
      expect(s.sensors.temp).toBe(27.4);
      expect(s.lastSeenLabel).toBeTruthy();
    }
  });
  it('fuzzy rain, bmkg dry', () => {
    const s = deriveHomeState({ ...base, bmkgNow: { weatherCode: 3, weatherDesc: 'Berawan' } });
    expect(s.kind === 'ok' && s.agreement).toBe('Fuzzy dan BMKG berbeda');
  });
  it('bmkg null', () => {
    const s = deriveHomeState({ ...base, bmkgNow: null });
    expect(s.kind === 'ok' && s.agreement).toBe('Prakiraan BMKG belum tersedia');
  });
  it('wet >= 30 -> basah', () => {
    const s = deriveHomeState({ ...base, reading: reading({ rainWetSeconds: 30 }) });
    expect(s.kind === 'ok' && s.rainWet).toBe(true);
  });
  it('ok headline and percent', () => {
    const s = deriveHomeState(base);
    expect(s).toMatchObject({ kind: 'ok', percent: 72, headline: 'Peluang hujan tinggi' });
  });
  it('verdict, tone and slot label', () => {
    const s = deriveHomeState({ ...base, prediction: pred({ probability: 51, predictRain: true, deltaP3h: -1.2 }), bmkgNow: { weatherCode: 3, weatherDesc: 'Berawan', slotLabel: '22.00–01.00' } });
    expect(s).toMatchObject({ verdict: 'Prediksi: Hujan (ambang > 50%)', agreementTone: 'bad', agreement: 'Fuzzy dan BMKG berbeda (slot 22.00–01.00)' });
    expect(s.kind !== 'empty' && s.sensors.deltaP3h).toBe(-1.2);
  });
});
