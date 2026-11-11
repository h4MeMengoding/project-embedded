'use client';
import { useEffect, useState } from 'react';
import { reviveLive, type LiveData } from '../lib/liveTypes';
import { subscribeLive } from '../lib/liveStream';

/**
 * Data terbaru tanpa refresh: WebSocket /ws/live (live tiap ~1 dtk, offline setelah heartbeat berhenti),
 * ditambah ambil ulang /api/live saat tersambung, saat menit baru masuk, dan tiap 60 dtk sebagai cadangan.
 */
export function useLive(initial: LiveData): LiveData {
  const [data, setData] = useState<LiveData>(initial);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (r.ok && !stop) setData(reviveLive(await r.json()));
      } catch {}
    };
    const off = subscribeLive((e) => {
      if (e.type === 'open' || e.type === 'minute') poll();
      else if (e.type === 'live') {
        const r = e.reading as { ts: string } | null;
        setData((p) => ({
          ...p,
          reading: r ? { ...(r as unknown as NonNullable<LiveData['reading']>), ts: new Date(r.ts) } : p.reading,
          device: { online: true, lastSeenAt: new Date(e.lastSeenAt as string), sensors: e.sensors as LiveData['device']['sensors'] },
        }));
      } else if (e.type === 'offline') {
        setData((p) => ({ ...p, device: { ...p.device, online: false } }));
      }
    });
    const timer = setInterval(poll, 60_000);
    return () => { stop = true; off(); clearInterval(timer); };
  }, []);

  return data;
}
