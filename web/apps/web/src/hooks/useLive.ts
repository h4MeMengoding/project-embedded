'use client';
import { useEffect, useState } from 'react';
import { reviveLive, type LiveData } from '../lib/liveTypes';

/** WebSocket ke wsUrl bila ada; jatuh ke polling /api/live tiap 10 detik. Tidak melempar bila keduanya gagal. */
export function useLive(initial: LiveData, wsUrl: string | null): LiveData {
  const [data, setData] = useState<LiveData>(initial);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let ws: WebSocket | undefined;

    const poll = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (r.ok && !stop) setData(reviveLive(await r.json()));
      } catch {}
    };
    const startPolling = () => {
      if (timer || stop) return;
      poll();
      timer = setInterval(poll, 10_000);
    };

    if (wsUrl) {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data);
            if (m.type === 'live' || m.type === 'minute') {
              setData((p) => ({
                ...p,
                reading: {
                  ts: new Date((m.ts ?? Date.now() / 1000) * 1000),
                  tempDht: m.temp_dht ?? null, humDht: m.hum_dht ?? null, pressureHpa: m.pressure_hpa ?? null,
                  lux: m.lux ?? null, rainWetSeconds: m.rain_wet === true ? 60 : m.rain_wet_seconds ?? 0,
                },
                device: { online: true, lastSeenAt: new Date() },
              }));
            } else if (m.type === 'prediction') {
              setData((p) => ({ ...p, prediction: { ts: new Date((m.ts ?? 0) * 1000), status: m.status ?? 'ok', probability: m.probability ?? null, category: m.category ?? null, predictRain: m.predict_rain ?? null } }));
            }
          } catch {}
        };
        ws.onerror = startPolling;
        ws.onclose = startPolling;
      } catch {
        startPolling();
      }
    } else startPolling();

    return () => {
      stop = true;
      if (timer) clearInterval(timer);
      ws?.close();
    };
  }, [wsUrl]);

  return data;
}
