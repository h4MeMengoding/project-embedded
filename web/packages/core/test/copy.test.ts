import { describe, it, expect } from 'vitest';
import { categoryCopy, agreementCopy, currentRainCopy } from '../src/copy';

describe('copy', () => {
  it('category', () => {
    expect(categoryCopy('Rendah')).toBe('Peluang hujan rendah');
    expect(categoryCopy('Sedang')).toBe('Peluang hujan sedang');
    expect(categoryCopy('Tinggi')).toBe('Peluang hujan tinggi');
  });
  it('agreement', () => {
    expect(agreementCopy(true, true)).toBe('Fuzzy dan BMKG sepakat');
    expect(agreementCopy(true, false)).toBe('Fuzzy dan BMKG berbeda');
    expect(agreementCopy(false, false)).toBe('Fuzzy dan BMKG sepakat');
    expect(agreementCopy(false, true)).toBe('Fuzzy dan BMKG berbeda');
    expect(agreementCopy(true, null)).toBe('Prakiraan BMKG belum tersedia');
  });
  it('current', () => {
    expect(currentRainCopy(false)).toBe('Sensor hujan: kering');
    expect(currentRainCopy(true)).toBe('Sensor hujan: basah');
    expect(currentRainCopy(null)).toBe('Status sensor hujan belum tersedia');
  });
});
