import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import {
  confusion, isRainForecast, labelActualRain, metricsOf, pickBmkgForecast, pickFuzzyPrediction, slotBounds,
  type Confusion, type Metrics,
} from '@ws/core';
import type { Db } from './client';
import { bmkgForecasts, evaluationSlots, fuzzyPredictions, readingsMinute, type EvaluationSlotRow } from './schema';

const MIN = 60_000;

export type RecomputeOpts = {
  deviceId: string;
  adm4: string;
  from: Date;
  to: Date;
  slotMode: 'start' | 'center';
  minWetMinutes: number;
  predictThreshold: number;
};

/** Slot berasal dari utc_datetime BMKG di rentang [from, to); menimpa evaluation_slots untuk rentang itu. */
export async function recomputeEvaluation(db: Db, o: RecomputeOpts): Promise<{ slots: number }> {
  const forecasts = await db.select().from(bmkgForecasts)
    .where(and(eq(bmkgForecasts.adm4, o.adm4), gte(bmkgForecasts.utcDatetime, o.from), lt(bmkgForecasts.utcDatetime, o.to)))
    .orderBy(asc(bmkgForecasts.utcDatetime));
  const utcs = [...new Set(forecasts.map((f) => f.utcDatetime.getTime()))].sort((a, b) => a - b);

  // tanpa prakiraan di rentang: jangan hapus hasil yang sudah ada
  if (utcs.length === 0) return { slots: 0 };

  const bounds = utcs.map((u) => slotBounds(new Date(u), o.slotMode));
  const minStart = new Date(Math.min(...bounds.map((b) => b.start.getTime())));
  const maxEnd = new Date(Math.max(...bounds.map((b) => b.end.getTime())));
  const minutes = await db.select({ ts: readingsMinute.ts, rainWetSeconds: readingsMinute.rainWetSeconds }).from(readingsMinute)
    .where(and(eq(readingsMinute.deviceId, o.deviceId), gte(readingsMinute.ts, minStart), lt(readingsMinute.ts, maxEnd)));
  const preds = await db.select().from(fuzzyPredictions)
    .where(and(eq(fuzzyPredictions.deviceId, o.deviceId), gte(fuzzyPredictions.ts, new Date(minStart.getTime() - 10 * MIN)), lte(fuzzyPredictions.ts, maxEnd)));

  const rows: (typeof evaluationSlots.$inferInsert)[] = utcs.map((u, i) => {
    const utc = new Date(u);
    const slot = bounds[i];
    const label = labelActualRain(minutes, slot, o.minWetMinutes);
    const fp = pickFuzzyPrediction(preds, slot.start);
    const bf = pickBmkgForecast(forecasts, utc, slot.start);
    const fuzzyPredictRain = fp?.probability != null ? fp.probability >= o.predictThreshold : null;
    const bmkgPredictRain = bf ? isRainForecast({ weatherCode: bf.weatherCode, weatherDesc: bf.weatherDesc }) : null;
    const correct = (p: boolean | null) => (label.actualRain == null || p == null ? null : label.actualRain === p);
    return {
      slotStart: slot.start,
      slotEnd: slot.end,
      deviceId: o.deviceId,
      wetMinutes: label.wetMinutes,
      dataMinutes: label.dataMinutes,
      actualRain: label.actualRain,
      fuzzyPredictionId: fp?.id ?? null,
      fuzzyPredictRain,
      fuzzyProbability: fp?.probability ?? null,
      bmkgForecastId: bf?.id ?? null,
      bmkgWeatherDesc: bf?.weatherDesc ?? null,
      bmkgPredictRain,
      fuzzyCorrect: correct(fuzzyPredictRain),
      bmkgCorrect: correct(bmkgPredictRain),
    };
  });
  await db.transaction(async (tx) => {
  const t = tx as unknown as Db;
  await t.delete(evaluationSlots).where(and(
    eq(evaluationSlots.deviceId, o.deviceId), gte(evaluationSlots.slotStart, o.from), lt(evaluationSlots.slotStart, o.to),
  ));
  for (let i = 0; i < rows.length; i += 500) {
    await t.insert(evaluationSlots).values(rows.slice(i, i + 500)).onConflictDoUpdate({
      target: [evaluationSlots.deviceId, evaluationSlots.slotStart],
      set: {
        slotEnd: sqlExcluded('slot_end'), wetMinutes: sqlExcluded('wet_minutes'), dataMinutes: sqlExcluded('data_minutes'),
        actualRain: sqlExcluded('actual_rain'), fuzzyPredictionId: sqlExcluded('fuzzy_prediction_id'),
        fuzzyPredictRain: sqlExcluded('fuzzy_predict_rain'), fuzzyProbability: sqlExcluded('fuzzy_probability'),
        bmkgForecastId: sqlExcluded('bmkg_forecast_id'), bmkgWeatherDesc: sqlExcluded('bmkg_weather_desc'),
        bmkgPredictRain: sqlExcluded('bmkg_predict_rain'), fuzzyCorrect: sqlExcluded('fuzzy_correct'), bmkgCorrect: sqlExcluded('bmkg_correct'),
      },
    });
  }
  });
  return { slots: rows.length };
}

function sqlExcluded(col: string) {
  return sql.raw(`excluded."${col}"`);
}

export async function getEvaluation(db: Db, deviceId: string, from: Date, to: Date): Promise<{
  slots: EvaluationSlotRow[];
  fuzzy: { cm: Confusion; metrics: Metrics };
  bmkg: { cm: Confusion; metrics: Metrics };
}> {
  const slots = await db.select().from(evaluationSlots)
    .where(and(eq(evaluationSlots.deviceId, deviceId), gte(evaluationSlots.slotStart, from), lt(evaluationSlots.slotStart, to)))
    .orderBy(asc(evaluationSlots.slotStart));
  const fcm = confusion(slots.map((s) => ({ actual: s.actualRain, predicted: s.fuzzyPredictRain })));
  const bcm = confusion(slots.map((s) => ({ actual: s.actualRain, predicted: s.bmkgPredictRain })));
  return { slots, fuzzy: { cm: fcm, metrics: metricsOf(fcm) }, bmkg: { cm: bcm, metrics: metricsOf(bcm) } };
}
