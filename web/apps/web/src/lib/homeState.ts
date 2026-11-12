import { agreementCopy, categoryCopy, currentRainCopy, dewPoint, formatWib, isPredictRain, isRainForecast, type Level3 } from '@ws/core';

export type HomeInput = {
  reading: { ts: Date; tempDht: number | null; humDht: number | null; pressureHpa: number | null; lux: number | null; rainWetSeconds: number | null } | null;
  prediction: { ts: Date; status: string; probability: number | null; category: string | null; predictRain: boolean | null; deltaP3h?: number | null } | null;
  bmkgNow: { weatherCode?: number | null; weatherDesc?: string | null; slotLabel?: string | null } | null;
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
      agreementTone: 'ok' | 'bad' | null;
      verdict: string | null;
      current: string;
      sensors: { temp: number | null; hum: number | null; pressure: number | null; lux: number | null; dewPoint: number | null; deltaP3h: number | null };
      lastSeenLabel: string | null;
      lastSeenTime: string | null;
    };

export function deriveHomeState(i: HomeInput): HomeState {
  const { reading, prediction, device } = i;
  if (!reading && !prediction && !device.lastSeenAt) return { kind: 'empty' };

  const predOk = prediction?.status === 'ok' && prediction.probability != null;
  const insufficient = prediction?.status === 'insufficient_data';
  const percent = predOk ? prediction!.probability : null;
  const fuzzyRain = predOk ? (prediction!.predictRain ?? isPredictRain(prediction!.probability!, i.threshold)) : null;
  const headline = predOk
    ? categoryCopy((prediction!.category ?? 'Rendah') as Level3)
    : insufficient
      ? 'Menunggu 3 jam data tekanan'
      : 'Prediksi belum tersedia';
  const bmkgRain = i.bmkgNow ? isRainForecast(i.bmkgNow) : null;
  const agreement = fuzzyRain == null ? null : agreementCopy(fuzzyRain, bmkgRain) + (bmkgRain != null && i.bmkgNow?.slotLabel ? ` (slot ${i.bmkgNow.slotLabel})` : '');
  const agreementTone = fuzzyRain == null || bmkgRain == null ? null : fuzzyRain === bmkgRain ? 'ok' : 'bad';
  const verdict = fuzzyRain == null ? null : `Prediksi: ${fuzzyRain ? 'Hujan' : 'Tidak hujan'} (ambang > ${i.threshold}%)`;
  const temp = reading?.tempDht ?? null;
  const hum = reading?.humDht ?? null;
  const seen = device.lastSeenAt ?? reading?.ts ?? null;

  return {
    kind: !device.online ? 'offline' : insufficient ? 'insufficient' : 'ok',
    percent,
    headline,
    agreement,
    agreementTone,
    verdict,
    current: currentRainCopy(reading?.rainWetSeconds != null ? reading.rainWetSeconds >= 30 : null),
    sensors: {
      temp,
      hum,
      pressure: reading?.pressureHpa ?? null,
      lux: reading?.lux ?? null,
      dewPoint: temp != null && hum != null ? dewPoint(temp, hum) : null,
      deltaP3h: predOk ? (prediction!.deltaP3h ?? null) : null,
    },
    lastSeenTime: seen ? formatWib(seen, 'time') : null,
    lastSeenLabel: seen ? `Data terakhir ${formatWib(seen, 'time')}` : null,
  };
}
