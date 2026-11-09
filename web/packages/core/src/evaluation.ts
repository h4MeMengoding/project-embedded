const MIN = 60_000;
const HOUR = 60 * MIN;

export type Slot = { start: Date; end: Date };

export function slotBounds(forecastUtc: Date, mode: 'start' | 'center'): Slot {
  const t = forecastUtc.getTime();
  const start = mode === 'start' ? t : t - 1.5 * HOUR;
  return { start: new Date(start), end: new Date(start + 3 * HOUR) };
}

export function labelActualRain(
  minutes: { ts: Date; rainWetSeconds: number | null }[],
  slot: Slot,
  minWetMinutes = 10,
): { wetMinutes: number; dataMinutes: number; actualRain: boolean | null } {
  let wetMinutes = 0;
  let dataMinutes = 0;
  for (const m of minutes) {
    const t = m.ts.getTime();
    if (t < slot.start.getTime() || t >= slot.end.getTime()) continue;
    dataMinutes++;
    if ((m.rainWetSeconds ?? 0) >= 30) wetMinutes++;
  }
  const actualRain = dataMinutes < 144 ? null : wetMinutes >= minWetMinutes;
  return { wetMinutes, dataMinutes, actualRain };
}

/** Prediksi 'ok' terbaru sebelum slotStart (menit slotStart sendiri mencakup 60 dtk sesudahnya, jadi dikecualikan), maksimal 10 menit sebelumnya. */
export function pickFuzzyPrediction<T extends { ts: Date; status: string }>(
  preds: T[],
  slotStart: Date,
): T | null {
  const s = slotStart.getTime();
  let best: T | null = null;
  for (const p of preds) {
    const t = p.ts.getTime();
    if (p.status !== 'ok' || t >= s || t < s - 10 * MIN) continue;
    if (!best || t > best.ts.getTime()) best = p;
  }
  return best;
}

/** Forecast untuk forecastUtc dengan analysisDate terbaru yang terbit sebelum slotStart. */
export function pickBmkgForecast<T extends { analysisDate: Date; utcDatetime: Date }>(
  forecasts: T[],
  forecastUtc: Date,
  slotStart: Date,
): T | null {
  let best: T | null = null;
  for (const f of forecasts) {
    if (f.utcDatetime.getTime() !== forecastUtc.getTime()) continue;
    if (f.analysisDate.getTime() >= slotStart.getTime()) continue;
    if (!best || f.analysisDate.getTime() > best.analysisDate.getTime()) best = f;
  }
  return best;
}

export type Confusion = { tp: number; fp: number; tn: number; fn: number };

export function confusion(rows: { actual: boolean | null; predicted: boolean | null }[]): Confusion {
  const cm: Confusion = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const r of rows) {
    if (r.actual == null || r.predicted == null) continue;
    if (r.actual) r.predicted ? cm.tp++ : cm.fn++;
    else r.predicted ? cm.fp++ : cm.tn++;
  }
  return cm;
}

export type Metrics = {
  n: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
};

const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

export function metricsOf(cm: Confusion): Metrics {
  const n = cm.tp + cm.fp + cm.tn + cm.fn;
  const precision = ratio(cm.tp, cm.tp + cm.fp);
  const recall = ratio(cm.tp, cm.tp + cm.fn);
  // F1 = 2TP / (2TP + FP + FN); tidak terdefinisi hanya bila TP, FP, dan FN semuanya 0
  const f1 = ratio(2 * cm.tp, 2 * cm.tp + cm.fp + cm.fn);
  return { n, accuracy: ratio(cm.tp + cm.tn, n), precision, recall, f1 };
}

export type SlotStatus = 'calibration' | 'upcoming' | 'running' | 'incomplete' | 'no_fuzzy' | 'no_bmkg' | 'ok';

/** Status slot untuk tampilan dan penyaringan metrik; urutan prioritas sama dengan urutan alasan pengecualian. */
export function slotStatus(
  s: { slotStart: Date; slotEnd: Date; actualRain: boolean | null; fuzzyPredictRain: boolean | null; bmkgPredictRain: boolean | null },
  now: Date,
  calib?: { start: Date | null; end: Date | null },
): SlotStatus {
  // slot yang beririsan dengan periode kalibrasi tidak boleh masuk metrik makalah
  if (calib?.end && s.slotStart.getTime() < calib.end.getTime() && s.slotEnd.getTime() > (calib.start?.getTime() ?? -Infinity)) return 'calibration';
  if (s.slotStart.getTime() > now.getTime()) return 'upcoming';
  if (s.slotEnd.getTime() > now.getTime()) return 'running';
  if (s.actualRain == null) return 'incomplete';
  if (s.fuzzyPredictRain == null) return 'no_fuzzy';
  if (s.bmkgPredictRain == null) return 'no_bmkg';
  return 'ok';
}
