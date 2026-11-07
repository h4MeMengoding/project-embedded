import { config } from 'dotenv';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { computeWindowInputs, runFuzzy, isPredictRain, FUZZY_CONFIG_V1, type MinuteRow } from '@ws/core';
import {
  createDb, recomputeEvaluation, devices, readingsMinute, rainEvents, fuzzyPredictions, bmkgForecasts, evaluationSlots,
  type Db,
} from '@ws/db';
import { assertDevEnvironment } from './guard';
import { generateSeries, generateBmkg, type Scenario } from './generate';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env.local') });

const SCENARIOS: Scenario[] = ['normal', 'offline', 'insufficient', 'disagree'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function insertChunked<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

export async function seed(db: Db, o: { deviceId: string; scenario: Scenario; days: number; reset: boolean; now?: Date }) {
  await assertDevEnvironment(db);
  const now = o.now ?? new Date();

  if (o.reset) {
    await db.delete(readingsMinute).where(eq(readingsMinute.deviceId, o.deviceId));
    await db.delete(rainEvents).where(eq(rainEvents.deviceId, o.deviceId));
    await db.delete(fuzzyPredictions).where(eq(fuzzyPredictions.deviceId, o.deviceId));
    await db.delete(evaluationSlots).where(eq(evaluationSlots.deviceId, o.deviceId));
    await db.delete(bmkgForecasts).where(eq(bmkgForecasts.adm4, 'SEED'));
  }

  const series = generateSeries({ end: now, days: o.days, seed: 42, scenario: o.scenario });
  const bmkg = generateBmkg({
    from: new Date(now.getTime() - o.days * 86400000),
    days: o.days + 3,
    scenario: o.scenario,
    now,
  });

  const lastTs = Math.max(...series.minutes.map((m) => m.ts.getTime()));
  const lastSeen = o.scenario === 'offline' ? new Date(lastTs + 60_000) : now;
  const tokenHash = 'seed:' + createHash('sha256').update(randomBytes(16)).digest('hex');
  const dev = {
    name: 'Stasiun seed',
    lastSeenAt: lastSeen,
    lastRssi: -67,
    fwVersion: 'seed',
    lastUptimeS: 3600 * 24,
    lastHeapFree: 182000,
    lastBacklog: 0,
    lastBufferFull: false,
  };
  await db.insert(devices).values({ id: o.deviceId, tokenHash, ...dev }).onConflictDoUpdate({ target: devices.id, set: dev });

  await insertChunked(series.minutes, (c) =>
    db.insert(readingsMinute).values(c.map((m) => ({ ...m, deviceId: o.deviceId }))).onConflictDoNothing(),
  );
  await insertChunked(series.rainEvents, (c) =>
    db.insert(rainEvents).values(c.map((e) => ({ ...e, deviceId: o.deviceId, receivedAt: e.ts }))).onConflictDoNothing(),
  );

  // prediksi fuzzy per menit, jendela geser (baris sudah terurut naik)
  const rows: MinuteRow[] = series.minutes
    .slice()
    .sort((a, b) => a.ts.getTime() - b.ts.getTime())
    .map((m) => ({ ts: m.ts, tempDht: m.tempDht, humDht: m.humDht, pressureHpa: m.pressureHpa }));
  const preds: (typeof fuzzyPredictions.$inferInsert)[] = [];
  let lo = 0;
  for (let i = 0; i < rows.length; i++) {
    const at = rows[i].ts;
    while (rows[lo].ts.getTime() < at.getTime() - 191 * 60_000) lo++;
    const w = computeWindowInputs(rows.slice(lo, i + 1), at);
    if (w.status !== 'ok') {
      preds.push({ deviceId: o.deviceId, ts: at, configVersion: FUZZY_CONFIG_V1.version, status: 'insufficient_data' });
      continue;
    }
    const r = runFuzzy({ deltaP3h: w.deltaP3h, rh: w.rh, dpd: w.dpd });
    preds.push({
      deviceId: o.deviceId, ts: at, configVersion: r.configVersion,
      deltaP3h: w.deltaP3h, rh: w.rh, dewPoint: w.dewPoint, dpd: w.dpd,
      memberships: r.memberships, ruleStrengths: r.ruleStrengths,
      probability: r.probability, category: r.category,
      predictRain: isPredictRain(r.probability), status: 'ok',
    });
  }
  await insertChunked(preds, (c) => db.insert(fuzzyPredictions).values(c).onConflictDoNothing());
  await insertChunked(bmkg, (c) => db.insert(bmkgForecasts).values(c).onConflictDoNothing());
  const ev = await recomputeEvaluation(db, {
    deviceId: o.deviceId,
    adm4: 'SEED',
    from: new Date(now.getTime() - o.days * 86400000),
    to: now,
    slotMode: process.env.BMKG_SLOT_MODE === 'center' ? 'center' : 'start',
    minWetMinutes: Number(process.env.RAIN_MIN_WET_MINUTES ?? 10),
    predictThreshold: Number(process.env.PREDICT_THRESHOLD ?? 50),
  });
  return { minutes: series.minutes.length, predictions: preds.length, bmkg: bmkg.length, evalSlots: ev.slots };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const scenario = (arg('scenario') ?? 'normal') as Scenario;
  if (!SCENARIOS.includes(scenario)) throw new Error(`scenario harus salah satu dari ${SCENARIOS.join('|')}`);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum diisi (web/.env.local)');
  const db = createDb(url, { max: 2 });
  const res = await seed(db, {
    deviceId: process.env.DEVICE_ID ?? 'stasiun-01',
    scenario,
    days: Number(arg('days') ?? 7),
    reset: process.argv.includes('--reset'),
  });
  console.log('seed selesai', scenario, res);
  process.exit(0);
}
