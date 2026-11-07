import { agreementCopy, categoryCopy, currentRainCopy, dewPoint, formatWib, isRainForecast, type Level3 } from '@ws/core';

export type HomeInput = {
  reading: { ts: Date; tempDht: number | null; humDht: number | null; pressureHpa: number | null; lux: number | null; rainWetSeconds: number | null } | null;
  prediction: { ts: Date; status: string; probability: number | null; category: string | null; predictRain: boolean | null } | null;
  bmkgNow: { weatherCode?: number | null; weatherDesc?: string | null } | null;
  device: { online: boolean; lastSeenAt: Date | null };
  threshold: number;
};

export type HomeState =
  | { kind: 'empty' }
  | {
      kind: 'ok' | 'insufficient' | 'offline';
      percent: number | null;
      headline: string;
      agreement: string | null;
      current: string;
      sensors: { temp: number | null; hum: number | null; pressure: number | null; lux: number | null; dewPoint: number | null };
      lastSeenLabel: string | null;
    };

export function deriveHomeState(i: HomeInput): HomeState {
  const { reading, prediction, device } = i;
  if (!reading && !prediction && !device.lastSeenAt) return { kind: 'empty' };

  const predOk = prediction?.status === 'ok' && prediction.probability != null;
  const insufficient = prediction?.status === 'insufficient_data';
  const percent = predOk ? prediction!.probability : null;
  const fuzzyRain = predOk ? (prediction!.predictRain ?? prediction!.probability! >= i.threshold) : null;
  const headline = predOk
    ? categoryCopy((prediction!.category ?? 'Rendah') as Level3)
    : insufficient
      ? 'Menunggu 3 jam data tekanan'
      : 'Belum ada prediksi';
  const agreement = fuzzyRain == null ? null : agreementCopy(fuzzyRain, i.bmkgNow ? isRainForecast(i.bmkgNow) : null);
  const temp = reading?.tempDht ?? null;
  const hum = reading?.humDht ?? null;
  const seen = device.lastSeenAt ?? reading?.ts ?? null;

  return {
    kind: !device.online ? 'offline' : insufficient ? 'insufficient' : 'ok',
    percent,
    headline,
    agreement,
    current: currentRainCopy(reading?.rainWetSeconds != null ? reading.rainWetSeconds >= 30 : null),
    sensors: {
      temp,
      hum,
      pressure: reading?.pressureHpa ?? null,
      lux: reading?.lux ?? null,
      dewPoint: temp != null && hum != null ? dewPoint(temp, hum) : null,
    },
    lastSeenLabel: seen ? `Data terakhir ${formatWib(seen, 'time')} WIB` : null,
  };
}
