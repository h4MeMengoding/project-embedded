import { describe, it, expect, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { IngestPayload, MinuteRecord } from '@ws/core';
import { HAS_DB, testDb } from './helpers';
import { devices, readingsMinute, rainEvents, fuzzyPredictions, appConfig } from '../src/schema';
import { ingestPayload } from '../src/ingest';
import { getActiveAdm4, getSetting, setSetting } from '../src/settings';

const rnd = () => Math.random().toString(36).slice(2, 8);
const T0 = Date.parse('2026-11-08T00:00:00Z') / 1000;

const minute = (i: number, extra: Partial<MinuteRecord> = {}): MinuteRecord => ({
  type: 'minute', ts: T0 + i * 60, temp_dht: 26, hum_dht: 92, temp_bmp: 26.5,
  pressure_hpa: 990 - i * 0.01, lux: null, rain_analog_avg: 4000, rain_wet_seconds: 0, samples: 6, backfill: false, ...extra,
});
const payload = (deviceId: string, records: IngestPayload['records']): IngestPayload => ({
  device_id: deviceId, fw: '1.0.0',
  status: { ts: T0, rssi: -60, uptime_s: 10, heap_free: 150000, backlog: 0, buffer_full: false, time_valid: true,
    sensors: { dht22: false, bmp280: true, bh1750: false, rain: true } },
  records, live: null,
});

describe.skipIf(!HAS_DB)('ingestPayload', () => {
  const db = HAS_DB ? testDb() : (null as never);
  const id = `test-ingest-${rnd()}`;
  const key = `test-${rnd()}`;
  afterAll(async () => {
    await db.delete(readingsMinute).where(eq(readingsMinute.deviceId, id));
    await db.delete(rainEvents).where(eq(rainEvents.deviceId, id));
    await db.delete(fuzzyPredictions).where(eq(fuzzyPredictions.deviceId, id));
    await db.delete(devices).where(eq(devices.id, id));
    await db.delete(appConfig).where(eq(appConfig.key, key));
  });

  it('simpan menit + event, update status perangkat', async () => {
    await db.insert(devices).values({ id, tokenHash: 'x' });
    const recs = Array.from({ length: 60 }, (_, i) => minute(i));
    const r = await ingestPayload(db, id, payload(id, [...recs, { type: 'rain_event', ts: T0 + 30, state: 'start', backfill: false }]), new Date());
    expect(r).toEqual({ stored: 61, duplicates: 0 });
    const [d] = await db.select().from(devices).where(eq(devices.id, id));
    expect(d.lastSensors).toEqual({ dht22: false, bmp280: true, bh1750: false, rain: true });
    expect(d.fwVersion).toBe('1.0.0');
    expect(d.lastSeenAt).not.toBeNull();
  });

  it('kirim ulang = duplikat, tidak error', async () => {
    const r = await ingestPayload(db, id, payload(id, [minute(0), minute(1)]), new Date());
    expect(r).toEqual({ stored: 0, duplicates: 2 });
  });

  it('prediksi tiap menit baru; ok setelah 3 jam data', async () => {
    for (let k = 1; k < 4; k++) {
      await ingestPayload(db, id, payload(id, Array.from({ length: 60 }, (_, i) => minute(k * 60 + i))), new Date());
    }
    const last = new Date((T0 + 239 * 60) * 1000);
    const [p] = await db.select().from(fuzzyPredictions)
      .where(and(eq(fuzzyPredictions.deviceId, id), eq(fuzzyPredictions.ts, last)));
    expect(p.status).toBe('ok');
    const [early] = await db.select().from(fuzzyPredictions)
      .where(and(eq(fuzzyPredictions.deviceId, id), eq(fuzzyPredictions.ts, new Date(T0 * 1000))));
    expect(early.status).toBe('insufficient_data');
  });

  it('backfill mengisi celah dan menghitung ulang prediksi sesudahnya', async () => {
    // celah menit 240..259, lalu menit 260..279 datang duluan
    await ingestPayload(db, id, payload(id, Array.from({ length: 20 }, (_, i) => minute(260 + i))), new Date());
    const at = new Date((T0 + 262 * 60) * 1000);
    const get = async () => (await db.select().from(fuzzyPredictions)
      .where(and(eq(fuzzyPredictions.deviceId, id), eq(fuzzyPredictions.ts, at))))[0];
    expect((await get()).status).toBe('insufficient_data'); // jendela 10 menit cuma 3 menit data
    await ingestPayload(db, id, payload(id, Array.from({ length: 20 }, (_, i) => minute(240 + i, { backfill: true }))), new Date());
    expect((await get()).status).toBe('ok');
    const [b] = await db.select().from(readingsMinute)
      .where(and(eq(readingsMinute.deviceId, id), eq(readingsMinute.ts, new Date((T0 + 245 * 60) * 1000))));
    expect(b.isBackfill).toBe(true);
  });

  it('setting', async () => {
    expect(await getSetting(db, key)).toBeNull();
    await setSetting(db, key, 'a');
    await setSetting(db, key, 'b');
    expect(await getSetting(db, key)).toBe('b');
    expect(typeof (await getActiveAdm4(db, 'ENV'))).toBe('string');
  });
});
