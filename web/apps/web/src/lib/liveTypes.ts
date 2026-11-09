import type { SensorFlags } from '@ws/core';
export type LiveReading = { ts: Date; tempDht: number | null; humDht: number | null; pressureHpa: number | null; lux: number | null; rainWetSeconds: number | null };
export type LivePrediction = { ts: Date; status: string; probability: number | null; category: string | null; predictRain: boolean | null; configVersion?: string; deltaP3h?: number | null };
export type LiveDevice = { online: boolean; lastSeenAt: Date | null; sensors?: SensorFlags | null };
export type LiveData = { reading: LiveReading | null; prediction: LivePrediction | null; device: LiveDevice };

const d = (v: unknown): Date | null => (typeof v === 'string' || v instanceof Date ? new Date(v) : null);

/** JSON dari /api/live: ubah string waktu menjadi Date. */
export function reviveLive(j: any): LiveData {
  return {
    reading: j?.reading ? { ...j.reading, ts: d(j.reading.ts)! } : null,
    prediction: j?.prediction ? { ...j.prediction, ts: d(j.prediction.ts)! } : null,
    device: { online: !!j?.device?.online, lastSeenAt: d(j?.device?.lastSeenAt), sensors: j?.device?.sensors ?? null },
  };
}
