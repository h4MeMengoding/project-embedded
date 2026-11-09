import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { bmkgForecasts, getEvaluation, rainEvents, type Db } from '@ws/db';
import { fuzzyPredictions, readingsMinute } from '@ws/db';
import type { Cell } from './csv';

export const KINDS = ['readings', 'rain-events', 'predictions', 'bmkg', 'evaluation'] as const;
export type Kind = (typeof KINDS)[number];

/** ISO dengan offset +07:00 untuk kolom *_wib. */
export const wibIso = (d: Date | null): string | null =>
  d ? new Date(d.getTime() + 7 * 3600_000).toISOString().replace('Z', '+07:00') : null;

const t2 = (d: Date | null): Cell[] => [d, wibIso(d)];

export async function buildExport(db: Db, kind: Kind, deviceId: string, from: Date, to: Date): Promise<{ headers: string[]; rows: Cell[][] }> {
  switch (kind) {
    case 'readings': {
      const r = await db.select().from(readingsMinute)
        .where(and(eq(readingsMinute.deviceId, deviceId), gte(readingsMinute.ts, from), lt(readingsMinute.ts, to))).orderBy(asc(readingsMinute.ts));
      return {
        headers: ['device_id', 'ts_utc', 'ts_wib', 'temp_dht', 'hum_dht', 'temp_bmp', 'pressure_hpa', 'lux', 'rain_analog_avg', 'rain_wet_seconds', 'samples', 'received_at_utc', 'is_backfill'],
        rows: r.map((x) => [x.deviceId, ...t2(x.ts), x.tempDht, x.humDht, x.tempBmp, x.pressureHpa, x.lux, x.rainAnalogAvg, x.rainWetSeconds, x.samples, x.receivedAt, x.isBackfill]),
      };
    }
    case 'rain-events': {
      const r = await db.select().from(rainEvents)
        .where(and(eq(rainEvents.deviceId, deviceId), gte(rainEvents.ts, from), lt(rainEvents.ts, to))).orderBy(asc(rainEvents.ts));
      return {
        headers: ['device_id', 'ts_utc', 'ts_wib', 'state', 'received_at_utc', 'is_backfill'],
        rows: r.map((x) => [x.deviceId, ...t2(x.ts), x.state, x.receivedAt, x.isBackfill]),
      };
    }
    case 'predictions': {
      const r = await db.select().from(fuzzyPredictions)
        .where(and(eq(fuzzyPredictions.deviceId, deviceId), gte(fuzzyPredictions.ts, from), lt(fuzzyPredictions.ts, to))).orderBy(asc(fuzzyPredictions.ts));
      return {
        headers: ['device_id', 'ts_utc', 'ts_wib', 'config_version', 'delta_p3h', 'rh', 'dew_point', 'dpd', 'probability', 'category', 'predict_rain', 'status'],
        rows: r.map((x) => [x.deviceId, ...t2(x.ts), x.configVersion, x.deltaP3h, x.rh, x.dewPoint, x.dpd, x.probability, x.category, x.predictRain, x.status]),
      };
    }
    case 'bmkg': {
      const r = await db.select().from(bmkgForecasts)
        .where(and(gte(bmkgForecasts.utcDatetime, from), lt(bmkgForecasts.utcDatetime, to))).orderBy(asc(bmkgForecasts.utcDatetime), asc(bmkgForecasts.analysisDate));
      return {
        headers: ['adm4', 'analysis_date_utc', 'utc_datetime', 'utc_datetime_wib', 'local_datetime', 't', 'hu', 'weather_code', 'weather_desc', 'tcc', 'ws', 'wd', 'fetched_at_utc'],
        rows: r.map((x) => [x.adm4, x.analysisDate, x.utcDatetime, wibIso(x.utcDatetime), x.localDatetime, x.t, x.hu, x.weatherCode, x.weatherDesc, x.tcc, x.ws, x.wd, x.fetchedAt]),
      };
    }
    case 'evaluation': {
      const ev = await getEvaluation(db, deviceId, from, to);
      return {
        headers: ['device_id', 'slot_start_utc', 'slot_start_wib', 'slot_end_utc', 'wet_minutes', 'data_minutes', 'actual_rain', 'fuzzy_probability', 'fuzzy_predict_rain', 'bmkg_weather_desc', 'bmkg_predict_rain', 'fuzzy_correct', 'bmkg_correct', 'status', 'in_metrics'],
        rows: ev.slots.map((x) => [x.deviceId, ...t2(x.slotStart), x.slotEnd, x.wetMinutes, x.dataMinutes, x.actualRain, x.fuzzyProbability, x.fuzzyPredictRain, x.bmkgWeatherDesc, x.bmkgPredictRain, x.fuzzyCorrect, x.bmkgCorrect, x.status, x.status === 'ok']),
      };
    }
  }
}
