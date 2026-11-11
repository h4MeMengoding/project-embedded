import { and, eq, gte, lte } from 'drizzle-orm';
import type { IngestPayload } from '@ws/core';
import type { Db } from './client';
import { devices, fuzzyPredictions, rainEvents, readingsMinute } from './schema';
import { computePredictions, PREDICTION_LOOKBACK_MIN } from './predictions';

const MIN = 60_000;

/**
 * Simpan payload perangkat (idempoten: duplikat diabaikan), perbarui status perangkat, lalu hitung fuzzy
 * untuk menit baru. Menit yang datang belakangan (backfill) juga memengaruhi prediksi hingga ~3 jam sesudahnya:
 * prediksi `insufficient_data` di rentang itu dihapus lalu dihitung ulang. Prediksi `ok` tidak pernah ditimpa.
 */
export async function ingestPayload(db: Db, deviceId: string, p: IngestPayload, now: Date, threshold = 50): Promise<{ stored: number; duplicates: number }> {
  const minutes = p.records.filter((r) => r.type === 'minute');
  const events = p.records.filter((r) => r.type === 'rain_event');
  const s = p.status;

  const res = await db.transaction(async (tx) => {
    const m = minutes.length === 0 ? [] : await tx.insert(readingsMinute).values(minutes.map((r) => ({
      deviceId, ts: new Date(r.ts * 1000), tempDht: r.temp_dht, humDht: r.hum_dht, tempBmp: r.temp_bmp,
      pressureHpa: r.pressure_hpa, lux: r.lux, rainAnalogAvg: r.rain_analog_avg, rainWetSeconds: r.rain_wet_seconds,
      samples: r.samples, receivedAt: now, isBackfill: r.backfill,
    }))).onConflictDoNothing().returning({ ts: readingsMinute.ts });
    const e = events.length === 0 ? [] : await tx.insert(rainEvents).values(events.map((r) => ({
      deviceId, ts: new Date(r.ts * 1000), state: r.state, receivedAt: now, isBackfill: r.backfill,
    }))).onConflictDoNothing().returning({ id: rainEvents.id });
    await tx.update(devices).set({
      lastSeenAt: now, lastRssi: s.rssi, fwVersion: p.fw, lastUptimeS: s.uptime_s, lastHeapFree: s.heap_free,
      lastBacklog: s.backlog, lastBufferFull: s.buffer_full, lastSensors: s.sensors, lastIp: s.ip,
    }).where(eq(devices.id, deviceId));
    return { ts: m.map((r) => r.ts), stored: m.length + e.length };
  });

  // Rentang dari SEMUA menit di payload (bukan hanya yang baru): jika hitung ulang sebelumnya gagal
  // setelah data tersimpan, kiriman ulang perangkat (duplikat) tetap memperbaikinya.
  if (minutes.length > 0) {
    const ms = minutes.map((r) => r.ts * 1000);
    const from = new Date(Math.min(...ms));
    const to = new Date(Math.max(...ms) + (PREDICTION_LOOKBACK_MIN - 1) * MIN);
    await db.delete(fuzzyPredictions).where(and(
      eq(fuzzyPredictions.deviceId, deviceId), eq(fuzzyPredictions.status, 'insufficient_data'),
      gte(fuzzyPredictions.ts, from), lte(fuzzyPredictions.ts, to),
    ));
    const affected = await db.select({ ts: readingsMinute.ts }).from(readingsMinute)
      .where(and(eq(readingsMinute.deviceId, deviceId), gte(readingsMinute.ts, from), lte(readingsMinute.ts, to)));
    await computePredictions(db, deviceId, affected.map((r) => r.ts), threshold);
  }
  return { stored: res.stored, duplicates: p.records.length - res.stored };
}
