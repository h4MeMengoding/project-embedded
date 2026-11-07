import { describe, it, expect, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { HAS_DB, testDb } from './helpers';
import { devices, readingsMinute, bmkgForecasts } from '../src/schema';
import {
  getLatestReading, getSeries, getCompleteness, getOfflineGaps, getLatencyStats, getDeviceStatus,
  getBmkgSlots, getRainIntervals, getBackfillStats,
} from '../src/queries';

const rnd = () => Math.random().toString(36).slice(2, 8);
const MIN = 60_000;

describe.skipIf(!HAS_DB)('queries', () => {
  const db = HAS_DB ? testDb() : (null as never);
  const made: string[] = [];
  const adm4s: string[] = [];
  const dev = () => { const d = `test-${rnd()}`; made.push(d); return d; };
  const put = (deviceId: string, ts: Date, extra: Partial<typeof readingsMinute.$inferInsert> = {}) =>
    db.insert(readingsMinute).values({ deviceId, ts, ...extra }).onConflictDoNothing();

  afterAll(async () => {
    for (const d of made) {
      await db.delete(readingsMinute).where(eq(readingsMinute.deviceId, d));
      await db.delete(devices).where(eq(devices.id, d));
    }
    for (const a of adm4s) await db.delete(bmkgForecasts).where(eq(bmkgForecasts.adm4, a));
  });

  const from = new Date('2026-11-06T17:00:00Z'); // 00:00 WIB 7 Nov
  const to = new Date('2026-11-08T17:00:00Z');

  it('unknown device is empty, no NaN', async () => {
    const d = dev();
    expect(await getLatestReading(db, d)).toBeNull();
    const s = await getSeries(db, d, from, to);
    expect(s.readings).toEqual([]);
    expect(s.predictions).toEqual([]);
    const c = await getCompleteness(db, d, from, to);
    expect(c.total.pct).toBe(0);
    expect(Number.isNaN(c.total.pct)).toBe(false);
    expect(await getOfflineGaps(db, d, from, to)).toEqual([]);
  });

  it('completeness groups by WIB day, expected 1440', async () => {
    const d = dev();
    await put(d, new Date('2026-11-07T17:30:00Z'));
    await put(d, new Date('2026-11-07T17:31:00Z'));
    await put(d, new Date('2026-11-07T16:59:00Z'));
    const c = await getCompleteness(db, d, from, to);
    const day = (k: string) => c.perDay.find((x) => x.dayWib === k)!;
    expect(day('2026-11-08').records).toBe(2);
    expect(day('2026-11-07').records).toBe(1);
    expect(day('2026-11-07').expected).toBe(1440);
    expect(c.total.records).toBe(3);
    expect(c.total.expected).toBe(2880);
  });

  it('offline gaps: 7min gap, exactly 5 not reported, 6 reported', async () => {
    const t0 = new Date('2026-11-07T01:00:00Z');
    const a = dev();
    for (const m of [0, 1, 2, 9]) await put(a, new Date(t0.getTime() + m * MIN));
    const g = await getOfflineGaps(db, a, from, to);
    expect(g).toHaveLength(1);
    expect(g[0].minutes).toBe(7);
    expect(g[0].start).toEqual(new Date(t0.getTime() + 2 * MIN));
    const b = dev();
    for (const m of [0, 5]) await put(b, new Date(t0.getTime() + m * MIN));
    expect(await getOfflineGaps(db, b, from, to)).toEqual([]);
    const c = dev();
    for (const m of [0, 6]) await put(c, new Date(t0.getTime() + m * MIN));
    expect(await getOfflineGaps(db, c, from, to)).toHaveLength(1);
  });

  it('latency ignores backfill', async () => {
    const d = dev();
    const t = new Date('2026-11-07T02:00:00Z');
    await put(d, t, { receivedAt: new Date(t.getTime() + 60_000 + 3000) });
    await put(d, new Date(t.getTime() + MIN), { receivedAt: new Date(t.getTime() + 999 * MIN), isBackfill: true });
    const l = await getLatencyStats(db, d, from, to);
    expect(l.count).toBe(1);
    expect(l.mean).toBeCloseTo(3, 1);
    expect(l.median).toBeCloseTo(3, 1);
    expect(l.p95).toBeCloseTo(3, 1);
  });

  it('device status online/offline/never seen', async () => {
    const d = dev();
    const now = new Date('2026-11-07T12:00:00Z');
    expect((await getDeviceStatus(db, d, 180, now)).lastSeenAt).toBeNull();
    expect((await getDeviceStatus(db, d, 180, now)).online).toBe(false);
    await db.insert(devices).values({ id: d, tokenHash: 'x', lastSeenAt: new Date(now.getTime() - 100_000), lastRssi: -60 });
    expect((await getDeviceStatus(db, d, 180, now)).online).toBe(true);
    expect((await getDeviceStatus(db, d, 60, now)).online).toBe(false);
    expect((await getDeviceStatus(db, d, 180, now)).rssi).toBe(-60);
  });

  it('bmkg slots: latest analysis only, ordered, limited', async () => {
    const adm4 = `T${rnd()}`;
    adm4s.push(adm4);
    const u = (h: number) => new Date(Date.UTC(2026, 10, 7, h));
    const row = (a: number, h: number, desc: string) => ({ adm4, analysisDate: new Date(Date.UTC(2026, 10, 6, a)), utcDatetime: u(h), weatherDesc: desc });
    await db.insert(bmkgForecasts).values([row(0, 12, 'lama'), row(12, 12, 'baru'), row(12, 15, 'x'), row(12, 18, 'y')]);
    const r = await getBmkgSlots(db, adm4, u(12), 2);
    expect(r.map((x) => x.weatherDesc)).toEqual(['baru', 'x']);
  });

  it('rain intervals merge consecutive wet minutes', async () => {
    const d = dev();
    const t = new Date('2026-11-07T03:00:00Z');
    for (const m of [0, 1, 2]) await put(d, new Date(t.getTime() + m * MIN), { rainWetSeconds: 60 });
    await put(d, new Date(t.getTime() + 3 * MIN), { rainWetSeconds: 10 });
    await put(d, new Date(t.getTime() + 10 * MIN), { rainWetSeconds: 45 });
    const r = await getRainIntervals(db, d, from, to);
    expect(r).toHaveLength(2);
    expect(r[0].start).toEqual(t);
    expect(r[0].end).toEqual(new Date(t.getTime() + 3 * MIN));
  });

  it('backfill stats', async () => {
    const d = dev();
    const t = new Date('2026-11-07T04:00:00Z');
    for (const m of [0, 1, 2, 3]) await put(d, new Date(t.getTime() + m * MIN), { isBackfill: m >= 1 });
    const s = await getBackfillStats(db, d, from, to);
    expect(s.backfillRecords).toBe(3);
    expect(s.longestOfflineMinutes).toBe(3);
  });
});
