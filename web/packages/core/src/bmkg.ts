export const BMKG_RAIN_CODES: readonly number[] = [60, 61, 63, 80, 95, 97];

/** Kode menang atas deskripsi; deskripsi dicocokkan kata "hujan" tanpa peka huruf besar/kecil. */
export function isRainForecast(f: { weatherCode?: number | null; weatherDesc?: string | null }): boolean {
  if (f.weatherCode != null && BMKG_RAIN_CODES.includes(f.weatherCode)) return true;
  return /hujan/i.test(f.weatherDesc ?? '');
}

export const BMKG_MAPPING_TABLE: { code: number; desc: string; rain: boolean }[] = [
  { code: 0, desc: 'Cerah', rain: false },
  { code: 1, desc: 'Cerah Berawan', rain: false },
  { code: 2, desc: 'Cerah Berawan', rain: false },
  { code: 3, desc: 'Berawan', rain: false },
  { code: 4, desc: 'Berawan Tebal', rain: false },
  { code: 5, desc: 'Udara Kabur', rain: false },
  { code: 10, desc: 'Asap', rain: false },
  { code: 45, desc: 'Berkabut', rain: false },
  { code: 60, desc: 'Hujan Ringan', rain: true },
  { code: 61, desc: 'Hujan Sedang', rain: true },
  { code: 63, desc: 'Hujan Lebat', rain: true },
  { code: 80, desc: 'Hujan Lokal', rain: true },
  { code: 95, desc: 'Hujan Petir', rain: true },
  { code: 97, desc: 'Hujan Petir', rain: true },
];
