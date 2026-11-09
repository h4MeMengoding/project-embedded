'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isOnline } from '../lib/online';
import { deriveHomeState } from '../lib/homeState';
import type { LiveData } from '../lib/liveTypes';
import { useLive } from '../hooks/useLive';
import { HeroPrediction } from './HeroPrediction';
import { SensorStrip } from './SensorStrip';

export function HomeLive({ initial, bmkgNow, threshold, offlineAfterSec }: {
  initial: LiveData;
  bmkgNow: { weatherCode: number | null; weatherDesc: string | null; slotLabel?: string | null } | null;
  threshold: number;
  offlineAfterSec: number;
}) {
  const raw = useLive(initial);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(id);
  }, []);
  // status online dihitung ulang dari lastSeenAt supaya tidak macet "Online" bila WS terbuka tapi perangkat mati
  const live = useMemo(
    () => ({ ...raw, device: { ...raw.device, online: isOnline(raw.device.lastSeenAt, now, offlineAfterSec) } }),
    [raw, now, offlineAfterSec],
  );
  const state = useMemo(
    () => deriveHomeState({ reading: live.reading, prediction: live.prediction, bmkgNow, device: live.device, threshold }),
    [live, bmkgNow, threshold],
  );
  // notifikasi perangkat: toast permanen selama offline, hilang + toast sukses saat kembali online
  const prevKind = useRef<string | null>(null);
  useEffect(() => {
    if (state.kind === 'empty') return;
    const offline = state.kind === 'offline';
    if (offline) {
      toast.error('Perangkat terputus', {
        id: 'device-offline',
        duration: Infinity,
        description: `${state.lastSeenLabel ?? 'Belum pernah terlihat'}. Nilai sensor bukan data terkini.`,
      });
    } else {
      toast.dismiss('device-offline');
      if (prevKind.current === 'offline') toast.success('Perangkat kembali online');
    }
    prevKind.current = state.kind;
  }, [state]);
  return (
    <>
      <HeroPrediction state={state} predictionTs={live.prediction?.ts ?? null} sensors={live.device.sensors ?? null} />
      <SensorStrip state={state} />
    </>
  );
}
