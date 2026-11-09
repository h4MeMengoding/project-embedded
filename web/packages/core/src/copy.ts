import type { Level3 } from './fuzzyConfig';

export function categoryCopy(c: Level3): string {
  return { Rendah: 'Peluang hujan rendah', Sedang: 'Peluang hujan sedang', Tinggi: 'Peluang hujan tinggi' }[c];
}

export function agreementCopy(fuzzyRain: boolean, bmkgRain: boolean | null): string {
  if (bmkgRain == null) return 'Prakiraan BMKG belum tersedia';
  return fuzzyRain === bmkgRain ? 'Fuzzy dan BMKG sepakat' : 'Fuzzy dan BMKG berbeda';
}

export function currentRainCopy(wet: boolean | null): string {
  if (wet == null) return 'Status sensor hujan belum tersedia';
  return wet ? 'Sensor hujan: basah' : 'Sensor hujan: kering';
}
