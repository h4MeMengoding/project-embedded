'use client';
import { useEffect, useMemo, useState } from 'react';
import { isOnline } from '../lib/online';
import { deriveHomeState } from '../lib/homeState';
import type { LiveData } from '../lib/liveTypes';
import { useLive } from '../hooks/useLive';
import { HeroPrediction } from './HeroPrediction';
import { SensorStrip } from './SensorStrip';

export function HomeLive({ initial, wsUrl, bmkgNow, threshold, offlineAfterSec }: {
  initial: LiveData;
  wsUrl: string | null;
  bmkgNow: { weatherCode: number | null; weatherDesc: string | null } | null;
  threshold: number;
  offlineAfterSec: number;
}) {
  const raw = useLive(initial, wsUrl);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
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
  return (
    <>
      <HeroPrediction state={state} predictionTs={live.prediction?.ts ?? null} />
      <SensorStrip state={state} />
    </>
  );
}
