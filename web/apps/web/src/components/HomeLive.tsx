'use client';
import { useMemo } from 'react';
import { deriveHomeState } from '../lib/homeState';
import type { LiveData } from '../lib/liveTypes';
import { useLive } from '../hooks/useLive';
import { HeroPrediction } from './HeroPrediction';
import { SensorStrip } from './SensorStrip';

export function HomeLive({ initial, wsUrl, bmkgNow, threshold }: {
  initial: LiveData;
  wsUrl: string | null;
  bmkgNow: { weatherCode: number | null; weatherDesc: string | null } | null;
  threshold: number;
}) {
  const live = useLive(initial, wsUrl);
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
