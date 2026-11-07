import type { Level3 } from './fuzzyConfig';

export function categoryCopy(c: Level3): string {
  return { Rendah: 'Kemungkinan kecil hujan', Sedang: 'Mungkin hujan', Tinggi: 'Kemungkinan besar akan turun hujan' }[c];
}

export function agreementCopy(fuzzyRain: boolean, bmkgRain: boolean | null): string {
  if (bmkgRain == null) return 'Prakiraan BMKG belum tersedia';
  if (fuzzyRain === bmkgRain) return bmkgRain ? 'BMKG juga memperkirakan hujan' : 'BMKG juga memperkirakan tidak hujan';
  return bmkgRain ? 'BMKG memperkirakan hujan' : 'BMKG memperkirakan tidak hujan';
}

export function currentRainCopy(wet: boolean | null): string {
  if (wet == null) return 'Status sensor hujan belum diketahui';
  return wet ? 'Saat ini sedang hujan' : 'Saat ini masih kering';
}
