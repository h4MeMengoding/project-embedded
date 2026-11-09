import { describe, it, expect, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { HAS_DB, testDb } from './helpers';
import { readingsMinute, fuzzyPredictions, bmkgForecasts, evaluationSlots } from '../src/schema';
import { recomputeEvaluation, getEvaluation } from '../src/evaluationJob';

const rnd = () => Math.random().toString(36).slice(2, 8);
const MIN = 60_000;
const H = 3600_000;

describe.skipIf(!HAS_DB)('evaluation job', () => {
  const db = HAS_DB ? testDb() : (null as never);
  const dev = `test-${rnd()}`;
  const adm4 = `T${rnd()}`;
  const T1 = new Date('2026-11-07T06:00:00Z');
  const T2 = new Date(T1.getTime() + 3 * H);
  const T3 = new Date(T1.getTime() + 6 * H);

  afterAll(async () => {
    await db.delete(readingsMinute).where(eq(readingsMinute.deviceId, dev));
    await db.delete(fuzzyPredictions).where(eq(fuzzyPredictions.deviceId, dev));
    await db.delete(evaluationSlots).where(eq(evaluationSlots.deviceId, dev));
    await db.delete(bmkgForecasts).where(eq(bmkgForecasts.adm4, adm4));
  });

  async function seed() {
    const mins = (start: Date, n: number, wet: number) =>
      Array.from({ length: n }, (_, i) => ({ deviceId: dev, ts: new Date(start.getTime() + i * MIN), rainWetSeconds: i < wet ? 60 : 0 }));
    await db.insert(readingsMinute).values([...mins(T1, 180, 12), ...mins(T2, 100, 30), ...mins(T3, 180, 0)]);
    const pred = (ts: Date, p: number) => ({ deviceId: dev, ts, configVersion: 'v1', probability: p, predictRain: p > 50, status: 'ok' });
    await db.insert(fuzzyPredictions).values([pred(new Date(T1.getTime() - MIN), 70), pred(new Date(T2.getTime() - MIN), 70), pred(new Date(T3.getTime() - MIN), 20)]);
    const bm = (utc: Date, analysis: Date, desc: string) => ({ adm4, analysisDate: analysis, utcDatetime: utc, weatherDesc: desc });
    await db.insert(bmkgForecasts).values([
      bm(T1, new Date(T1.getTime() - H), 'Hujan Ringan'),
      bm(T2, new Date(T2.getTime() - H), 'Hujan Ringan'),
      bm(T3, new Date(T3.getTime() + H), 'Hujan Ringan'), // terbit setelah slotStart -> tidak boleh dipakai
    ]);
  }
  const opts = () => ({ deviceId: dev, adm4, from: T1, to: new Date(T3.getTime() + 3 * H), slotMode: 'start' as const, minWetMinutes: 10, predictThreshold: 50 });

  it('computes slots, excludes incomplete, handles missing bmkg, idempotent', async () => {
    await seed();
    const r1 = await recomputeEvaluation(db, opts());
    expect(r1.slots).toBe(3);
    await recomputeEvaluation(db, opts());
    const ev = await getEvaluation(db, dev, T1, new Date(T3.getTime() + 3 * H), new Date(T3.getTime() + 4 * H));
    expect(ev.slots).toHaveLength(3);

    const s1 = ev.slots[0];
    expect(s1).toMatchObject({ actualRain: true, fuzzyCorrect: true, bmkgCorrect: true, wetMinutes: 12, dataMinutes: 180 });

    const s2 = ev.slots[1];
    expect(s2.actualRain).toBeNull();
    expect(s2.fuzzyCorrect).toBeNull();
    expect(s2.bmkgCorrect).toBeNull();

    const s3 = ev.slots[2];
    expect(s3.bmkgPredictRain).toBeNull();
    expect(s3.fuzzyPredictRain).toBe(false);
    expect(s3.fuzzyCorrect).toBe(true);

    // metrik hanya pada slot yang punya aktual, fuzzy, dan BMKG sekaligus: slot 2 (data tidak lengkap) dan 3 (tanpa BMKG) dikecualikan
    expect(ev.fuzzy.cm).toEqual({ tp: 1, fp: 0, tn: 0, fn: 0 });
    expect(ev.bmkg.cm).toEqual({ tp: 1, fp: 0, tn: 0, fn: 0 });
    expect(ev.evaluated).toBe(1);
    expect(ev.fuzzy.metrics.n).toBe(1);
    expect(ev.bmkg.metrics.n).toBe(1);
    expect(ev.excluded).toMatchObject({ incomplete: 1, no_bmkg: 1, running: 0, upcoming: 0, calibration: 0 });
    expect(ev.slots.map((x) => x.status)).toEqual(['ok', 'incomplete', 'no_bmkg']);
  });

  it('does not wipe existing slots when range has no bmkg forecasts', async () => {
    const before = await getEvaluation(db, dev, T1, new Date(T3.getTime() + 3 * H));
    expect(before.slots.length).toBeGreaterThan(0);
    await recomputeEvaluation(db, { ...opts(), adm4: `none-${rnd()}` });
    const after = await getEvaluation(db, dev, T1, new Date(T3.getTime() + 3 * H));
    expect(after.slots).toHaveLength(before.slots.length);
  });
});
