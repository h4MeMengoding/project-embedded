import type { SensorFlags } from '@ws/core';

// Hub realtime di dalam proses Next.js (asumsi satu instance, sama seperti cron di jobs.ts).
// wsServer menerbitkan event dari /ws/device dan meneruskannya ke browser lewat /ws/live.

export type LiveReadingJson = {
  ts: string; tempDht: number | null; humDht: number | null; pressureHpa: number | null; lux: number | null; rainWetSeconds: number | null;
};
export type LiveEvent =
  | { type: 'live'; deviceId: string; lastSeenAt: string; sensors: SensorFlags; reading: LiveReadingJson | null }
  | { type: 'minute'; deviceId: string }
  | { type: 'offline'; deviceId: string; lastSeenAt: string };

type Listener = (e: LiveEvent) => void;
type Hub = { listeners: Set<Listener>; timers: Map<string, ReturnType<typeof setTimeout>>; last: Map<string, LiveEvent & { type: 'live' }> };

const g = globalThis as unknown as { __wsHub?: Hub };
const hub = (): Hub => (g.__wsHub ??= { listeners: new Set(), timers: new Map(), last: new Map() });

export function subscribe(fn: Listener): () => void {
  hub().listeners.add(fn);
  return () => { hub().listeners.delete(fn); };
}

export function publish(e: LiveEvent): void {
  if (e.type === 'live') hub().last.set(e.deviceId, e);
  for (const fn of hub().listeners) {
    try { fn(e); } catch {}
  }
}

export function lastLive(deviceId: string): (LiveEvent & { type: 'live' }) | null {
  return hub().last.get(deviceId) ?? null;
}

/** Terbitkan `live` lalu jadwalkan `offline` jika tidak ada kabar lagi dalam offlineAfterSec. */
export function publishLive(e: LiveEvent & { type: 'live' }, offlineAfterSec: number): void {
  const h = hub();
  clearTimeout(h.timers.get(e.deviceId));
  h.timers.set(e.deviceId, setTimeout(() => {
    h.timers.delete(e.deviceId);
    publish({ type: 'offline', deviceId: e.deviceId, lastSeenAt: e.lastSeenAt });
  }, offlineAfterSec * 1000));
  publish(e);
}
