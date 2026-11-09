import type { SensorFlags } from '@ws/core';
import { and, asc, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { wibDayKey } from '@ws/core';
import type { Db } from './client';
import {
  bmkgForecasts, devices, fuzzyPredictions, readingsMinute,
  type BmkgRow, type PredictionRow, type ReadingRow,
} from './schema';

const MIN = 60_000;
const WIB = 7 * 3600_000;

export type DeviceStatus = {
  online: boolean;
  lastSeenAt: Date | null;
  rssi: number | null;
  uptimeS: number | null;
  heapFree: number | null;
  backlog: number | null;
  fwVersion: string | null;
  bufferFull: boolean | null;
  /** Sensor yang terdeteksi firmware; null jika perangkat belum pernah melapor. */
  sensors: SensorFlags | null;
};

export async function getLatestReading(db: Db, deviceId: string): Promise<ReadingRow | null> {
  const r = await db.select().from(readingsMinute).where(eq(readingsMinute.deviceId, deviceId)).orderBy(desc(readingsMinute.ts)).limit(1);
  return r[0] ?? null;
}

export async function getLatestPrediction(db: Db, deviceId: string): Promise<PredictionRow | null> {
  const r = await db.select().from(fuzzyPredictions).where(eq(fuzzyPredictions.deviceId, deviceId)).orderBy(desc(fuzzyPredictions.ts)).limit(1);
  return r[0] ?? null;
}

export async function getDeviceStatus(db: Db, deviceId: string, offlineAfterSec: number, now: Date): Promise<DeviceStatus> {
  const [d] = await db.select().from(devices).where(eq(devices.id, deviceId));
  const lastSeenAt = d?.lastSeenAt ?? null;
  return {
    online: lastSeenAt != null && now.getTime() - lastSeenAt.getTime() <= offlineAfterSec * 1000,
    lastSeenAt,
    rssi: d?.lastRssi ?? null,
    uptimeS: d?.lastUptimeS ?? null,
    heapFree: d?.lastHeapFree ?? null,
    backlog: d?.lastBacklog ?? null,
    fwVersion: d?.fwVersion ?? null,
    bufferFull: d?.lastBufferFull ?? null,
    sensors: (d?.lastSensors as SensorFlags | null | undefined) ?? null,
  };
}

const inRange = (deviceId: string, from: Date, to: Date) =>
  and(eq(readingsMinute.deviceId, deviceId), gte(readingsMinute.ts, from), lt(readingsMinute.ts, to));

export async function getSeries(db: Db, deviceId: string, from: Date, to: Date): Promise<{ readings: ReadingRow[]; predictions: PredictionRow[] }> {
  const readings = await db.select().from(readingsMinute).where(inRange(deviceId, from, to)).orderBy(asc(readingsMinute.ts));
  const predictions = await db.select().from(fuzzyPredictions)
    .where(and(eq(fuzzyPredictions.deviceId, deviceId), gte(fuzzyPredictions.ts, from), lt(fuzzyPredictions.ts, to)))
    .orderBy(asc(fuzzyPredictions.ts));
  return { readings, predictions };
}

/** Menit basah berurutan digabung menjadi satu interval [menit pertama, menit terakhir + 1 menit). */
export async function getRainIntervals(db: Db, deviceId: string, from: Date, to: Date): Promise<{ start: Date; end: Date }[]> {
  const rows = await db.select({ ts: readingsMinute.ts }).from(readingsMinute)
    .where(and(inRange(deviceId, from, to), gte(readingsMinute.rainWetSeconds, 30)))
    .orderBy(asc(readingsMinute.ts));
  const out: { start: Date; end: Date }[] = [];
  for (const { ts } of rows) {
    const last = out[out.length - 1];
    if (last && ts.getTime() === last.end.getTime()) last.end = new Date(ts.getTime() + MIN);
    else out.push({ start: ts, end: new Date(ts.getTime() + MIN) });
  }
  return out;
}

/** Hanya analysis_date terbaru per utc_datetime; terurut naik; dibatasi count. */
export async function getBmkgSlots(db: Db, adm4: string, fromUtc: Date, count: number): Promise<BmkgRow[]> {
  const rows = await db.select().from(bmkgForecasts)
    .where(and(eq(bmkgForecasts.adm4, adm4), gte(bmkgForecasts.utcDatetime, fromUtc)))
    .orderBy(asc(bmkgForecasts.utcDatetime), desc(bmkgForecasts.analysisDate))
    .limit(Math.max(1, count) * 40);
  const out: BmkgRow[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    const k = r.utcDatetime.getTime();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= count) break;
  }
  return out;
}

async function tsList(db: Db, deviceId: string, from: Date, to: Date): Promise<Date[]> {
  const rows = await db.select({ ts: readingsMinute.ts }).from(readingsMinute).where(inRange(deviceId, from, to)).orderBy(asc(readingsMinute.ts));
  return rows.map((r) => r.ts);
}

export async function getCompleteness(db: Db, deviceId: string, from: Date, to: Date) {
  const ts = await tsList(db, deviceId, from, to);
  const counts = new Map<string, number>();
  for (const t of ts) counts.set(wibDayKey(t), (counts.get(wibDayKey(t)) ?? 0) + 1);

  // menit yang seharusnya per hari WIB = irisan rentang dengan hari itu
  const expected = new Map<string, number>();
  const fromMin = Math.ceil(from.getTime() / MIN);
  const toMin = Math.floor(to.getTime() / MIN);
  for (let m = fromMin; m < toMin; m++) {
    const k = wibDayKey(new Date(m * MIN));
    expected.set(k, (expected.get(k) ?? 0) + 1);
  }
  const pct = (r: number, e: number) => (e === 0 ? 0 : (r / e) * 100);
  const perDay = [...expected.keys()].sort().map((dayWib) => {
    const records = counts.get(dayWib) ?? 0;
    const exp = expected.get(dayWib)!;
    return { dayWib, records, expected: exp, pct: pct(records, exp) };
  });
  const records = ts.length;
  const exp = perDay.reduce((a, d) => a + d.expected, 0);
  return { perDay, total: { records, expected: exp, pct: pct(records, exp) } };
}

export async function getLatencyStats(db: Db, deviceId: string, from: Date, to: Date) {
  const r = (await db.execute(sql`
    select count(*)::int as count,
      avg(l) as mean,
      percentile_cont(0.5) within group (order by l) as median,
      percentile_cont(0.95) within group (order by l) as p95
    from (select extract(epoch from (received_at - (ts + interval '60 seconds'))) as l
          from readings_minute
          where device_id = ${deviceId} and ts >= ${from.toISOString()}::timestamptz and ts < ${to.toISOString()}::timestamptz and is_backfill = false) x`)) as unknown as
    { count: number; mean: string | null; median: string | null; p95: string | null }[];
  const row = r[0];
  const n = (v: string | null | undefined) => (v == null ? null : Number(v));
  return { count: Number(row?.count ?? 0), mean: n(row?.mean), median: n(row?.median), p95: n(row?.p95) };
}

export async function getOfflineGaps(db: Db, deviceId: string, from: Date, to: Date, minGapMinutes = 5) {
  const ts = await tsList(db, deviceId, from, to);
  const gaps: { start: Date; end: Date; minutes: number }[] = [];
  for (let i = 1; i < ts.length; i++) {
    const minutes = (ts[i].getTime() - ts[i - 1].getTime()) / MIN;
    if (minutes > minGapMinutes) gaps.push({ start: ts[i - 1], end: ts[i], minutes });
  }
  return gaps;
}

export async function getBackfillStats(db: Db, deviceId: string, from: Date, to: Date) {
  const rows = await db.select({ ts: readingsMinute.ts, b: readingsMinute.isBackfill }).from(readingsMinute)
    .where(inRange(deviceId, from, to)).orderBy(asc(readingsMinute.ts));
  let backfillRecords = 0;
  let run = 0;
  let longestRun = 0;
  let prev: number | null = null;
  for (const r of rows) {
    if (r.b) {
      backfillRecords++;
      run = prev != null && r.ts.getTime() - prev === MIN && run > 0 ? run + 1 : 1;
      longestRun = Math.max(longestRun, run);
    } else run = 0;
    prev = r.ts.getTime();
  }
  const gaps = await getOfflineGaps(db, deviceId, from, to, 1);
  const longestGap = gaps.reduce((a, g) => Math.max(a, g.minutes), 0);
  return { backfillRecords, longestOfflineMinutes: Math.max(longestRun, longestGap) };
}
