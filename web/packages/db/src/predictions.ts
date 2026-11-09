import { and, eq, gte, lte, asc } from 'drizzle-orm';
import { computeWindowInputs, runFuzzy, isPredictRain, ACTIVE_FUZZY_CONFIG, type MinuteRow } from '@ws/core';
import type { Db } from './client';
import { fuzzyPredictions, readingsMinute } from './schema';

const MIN = 60_000;
/** Jendela terlama yang dibaca computeWindowInputs: 10 menit yang berakhir 3 jam sebelumnya. */
export const PREDICTION_LOOKBACK_MIN = 191;

/** Prediksi fuzzy dari baris menit terurut naik; satu baris per menit target. */
export function buildPredictions(rows: MinuteRow[], targets: Date[], deviceId: string, threshold = 50): (typeof fuzzyPredictions.$inferInsert)[] {
  const out: (typeof fuzzyPredictions.$inferInsert)[] = [];
  let lo = 0, hi = 0;
  for (const at of [...targets].sort((a, b) => a.getTime() - b.getTime())) {
    while (lo < rows.length && rows[lo].ts.getTime() < at.getTime() - PREDICTION_LOOKBACK_MIN * MIN) lo++;
    while (hi < rows.length && rows[hi].ts.getTime() <= at.getTime()) hi++;
    const w = computeWindowInputs(rows.slice(lo, hi), at);
    if (w.status !== 'ok') {
      out.push({ deviceId, ts: at, configVersion: ACTIVE_FUZZY_CONFIG.version, status: 'insufficient_data' });
      continue;
    }
    const r = runFuzzy({ deltaP3h: w.deltaP3h, rh: w.rh, dpd: w.dpd });
    out.push({
      deviceId, ts: at, configVersion: r.configVersion,
      deltaP3h: w.deltaP3h, rh: w.rh, dewPoint: w.dewPoint, dpd: w.dpd,
      memberships: r.memberships, ruleStrengths: r.ruleStrengths,
      probability: r.probability, category: r.category,
      predictRain: isPredictRain(r.probability, threshold), status: 'ok',
    });
  }
  return out;
}

/** Hitung dan simpan prediksi untuk menit-menit target (yang sudah ada tidak ditimpa). Mengembalikan jumlah baris baru. */
export async function computePredictions(db: Db, deviceId: string, minutes: Date[], threshold = 50): Promise<number> {
  if (minutes.length === 0) return 0;
  const ms = minutes.map((d) => d.getTime());
  const from = new Date(Math.min(...ms) - PREDICTION_LOOKBACK_MIN * MIN);
  const to = new Date(Math.max(...ms));
  const rows: MinuteRow[] = await db
    .select({ ts: readingsMinute.ts, tempDht: readingsMinute.tempDht, humDht: readingsMinute.humDht, pressureHpa: readingsMinute.pressureHpa })
    .from(readingsMinute)
    .where(and(eq(readingsMinute.deviceId, deviceId), gte(readingsMinute.ts, from), lte(readingsMinute.ts, to)))
    .orderBy(asc(readingsMinute.ts));
  const preds = buildPredictions(rows, minutes, deviceId, threshold);
  let n = 0;
  for (let i = 0; i < preds.length; i += 500) {
    const r = await db.insert(fuzzyPredictions).values(preds.slice(i, i + 500)).onConflictDoNothing().returning({ id: fuzzyPredictions.id });
    n += r.length;
  }
  return n;
}
