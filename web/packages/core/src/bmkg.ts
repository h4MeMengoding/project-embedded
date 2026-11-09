export const BMKG_RAIN_CODES: readonly number[] = [60, 61, 63, 80, 95, 97];

/** Kode menang atas deskripsi; deskripsi dicocokkan kata "hujan" tanpa peka huruf besar/kecil. */
export function isRainForecast(f: { weatherCode?: number | null; weatherDesc?: string | null }): boolean {
  if (f.weatherCode != null && BMKG_RAIN_CODES.includes(f.weatherCode)) return true;
  return /hujan/i.test(f.weatherDesc ?? '');
}

export const BMKG_MAPPING_TABLE: { code: number; desc: string; rain: boolean }[] = [
  { code: 0, desc: 'Cerah', rain: false },
  { code: 1, desc: 'Cerah', rain: false }, // dari respons asli 2026-11-09
  { code: 2, desc: 'Cerah Berawan', rain: false },
  { code: 3, desc: 'Berawan', rain: false },
  { code: 4, desc: 'Berawan Tebal', rain: false },
  { code: 5, desc: 'Udara Kabur', rain: false },
  { code: 10, desc: 'Asap', rain: false },
  { code: 45, desc: 'Berkabut', rain: false },
  { code: 60, desc: 'Hujan Ringan', rain: true },
  { code: 61, desc: 'Hujan Ringan', rain: true }, // dari respons asli 2026-11-09
  { code: 63, desc: 'Hujan Lebat', rain: true },
  { code: 80, desc: 'Hujan Lokal', rain: true },
  { code: 95, desc: 'Hujan Petir', rain: true },
  { code: 97, desc: 'Hujan Petir', rain: true },
];

export type BmkgLocation = {
  adm4: string; desa: string; kecamatan: string; kotkab: string; provinsi: string; lat: number; lon: number;
};
export type ParsedForecast = {
  analysisDate: Date; utcDatetime: Date; localDatetime: string;
  t: number | null; hu: number | null; weatherCode: number | null; weatherDesc: string | null;
  tcc: number | null; ws: number | null; wd: string | null; raw: unknown;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
/** BMKG menulis waktu UTC tanpa zona: "2026-11-09 14:00:00" atau "2026-11-09T12:00:00". */
function utc(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parser respons `GET https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=...`.
 * Struktur (dari respons asli): `data[0].lokasi`, `data[0].cuaca[hari][slot]`.
 * `unknown` berisi "<kode> <deskripsi>" yang tidak ada di tabel pemetaan (untuk log peringatan).
 */
export function parseBmkg(json: unknown): { location: BmkgLocation; forecasts: ParsedForecast[]; unknown: string[] } {
  const d0 = isObj(json) && Array.isArray(json.data) ? json.data[0] : undefined;
  if (!isObj(d0) || !Array.isArray(d0.cuaca) || !isObj(d0.lokasi)) throw new Error('Respons BMKG tidak dikenali');
  const l = d0.lokasi;
  const location: BmkgLocation = {
    adm4: String(l.adm4 ?? ''), desa: String(l.desa ?? ''), kecamatan: String(l.kecamatan ?? ''),
    kotkab: String(l.kotkab ?? ''), provinsi: String(l.provinsi ?? ''),
    lat: Number(l.lat), lon: Number(l.lon),
  };
  const known = new Set(BMKG_MAPPING_TABLE.map((r) => r.code));
  const unknown = new Set<string>();
  const forecasts: ParsedForecast[] = [];
  for (const day of d0.cuaca) {
    if (!Array.isArray(day)) continue;
    for (const c of day) {
      if (!isObj(c)) continue;
      const utcDatetime = utc(c.utc_datetime);
      const analysisDate = utc(c.analysis_date);
      if (!utcDatetime || !analysisDate) continue;
      const weatherCode = numOrNull(c.weather);
      const weatherDesc = strOrNull(c.weather_desc);
      if (weatherCode == null || !known.has(weatherCode)) unknown.add(`${weatherCode} ${weatherDesc}`);
      forecasts.push({
        analysisDate, utcDatetime, localDatetime: String(c.local_datetime ?? ''),
        t: numOrNull(c.t), hu: numOrNull(c.hu), weatherCode, weatherDesc,
        tcc: numOrNull(c.tcc), ws: numOrNull(c.ws), wd: strOrNull(c.wd), raw: c,
      });
    }
  }
  forecasts.sort((a, b) => a.utcDatetime.getTime() - b.utcDatetime.getTime());
  return { location, forecasts, unknown: [...unknown] };
}
