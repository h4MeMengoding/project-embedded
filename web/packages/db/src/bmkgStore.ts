import type { ParsedForecast } from '@ws/core';
import type { Db } from './client';
import { bmkgForecasts } from './schema';

/** Simpan prakiraan BMKG; baris (adm4, analysis_date, utc_datetime) yang sudah ada tidak diubah. */
export async function storeBmkg(db: Db, adm4: string, f: ParsedForecast[], fetchedAt = new Date()): Promise<number> {
  if (f.length === 0) return 0;
  const r = await db.insert(bmkgForecasts).values(f.map((x) => ({
    adm4, analysisDate: x.analysisDate, utcDatetime: x.utcDatetime, localDatetime: x.localDatetime,
    t: x.t, hu: x.hu, weatherCode: x.weatherCode, weatherDesc: x.weatherDesc, tcc: x.tcc, ws: x.ws, wd: x.wd,
    raw: x.raw, fetchedAt,
  }))).onConflictDoNothing().returning({ id: bmkgForecasts.id });
  return r.length;
}
