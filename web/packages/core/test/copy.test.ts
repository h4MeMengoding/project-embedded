import { describe, it, expect } from 'vitest';
import { categoryCopy, agreementCopy, currentRainCopy } from '../src/copy';

describe('copy', () => {
  it('category', () => {
    expect(categoryCopy('Rendah')).toBe('Kemungkinan kecil hujan');
    expect(categoryCopy('Sedang')).toBe('Mungkin hujan');
    expect(categoryCopy('Tinggi')).toBe('Kemungkinan besar akan turun hujan');
  });
  it('agreement', () => {
    expect(agreementCopy(true, true)).toBe('BMKG juga memperkirakan hujan');
    expect(agreementCopy(true, false)).toBe('BMKG memperkirakan tidak hujan');
    expect(agreementCopy(false, false)).toBe('BMKG juga memperkirakan tidak hujan');
    expect(agreementCopy(false, true)).toBe('BMKG memperkirakan hujan');
    expect(agreementCopy(true, null)).toBe('Prakiraan BMKG belum tersedia');
  });
  it('current', () => {
    expect(currentRainCopy(false)).toBe('Saat ini masih kering');
    expect(currentRainCopy(true)).toBe('Saat ini sedang hujan');
    expect(currentRainCopy(null)).toBe('Status sensor hujan belum diketahui');
  });
});
