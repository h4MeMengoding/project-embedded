export type AppEnv = {
  deviceId: string;
  adm4: string;
  slotMode: 'start' | 'center';
  predictThreshold: number;
  rainMinWetMinutes: number;
  evalStart: Date | null;
  evalEnd: Date | null;
  calibStart: Date | null;
  calibEnd: Date | null;
  offlineAfterSec: number;
};

type Source = Record<string, string | undefined>;

function num(src: Source, name: string, def: number): number {
  const raw = src[name];
  if (raw == null || raw.trim() === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} harus berupa angka, nilai: "${raw}"`);
  return n;
}

function date(src: Source, name: string): Date | null {
  const raw = src[name];
  if (raw == null || raw.trim() === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`${name} bukan tanggal ISO yang valid: "${raw}"`);
  return d;
}

export function getEnv(src: Source = process.env): AppEnv {
  const mode = src.BMKG_SLOT_MODE?.trim() || 'start';
  if (mode !== 'start' && mode !== 'center') throw new Error(`BMKG_SLOT_MODE harus start atau center, nilai: "${mode}"`);
  const calibEnd = date(src, 'CALIB_END');
  const evalStart = date(src, 'EVAL_START');
  if (calibEnd && evalStart && calibEnd > evalStart) throw new Error('CALIB_END harus lebih awal atau sama dengan EVAL_START');
  return {
    deviceId: src.DEVICE_ID?.trim() || 'stasiun-01',
    adm4: src.BMKG_ADM4?.trim() || 'SEED',
    slotMode: mode,
    predictThreshold: num(src, 'PREDICT_THRESHOLD', 50),
    rainMinWetMinutes: num(src, 'RAIN_MIN_WET_MINUTES', 10),
    evalStart: date(src, 'EVAL_START'),
    evalEnd: date(src, 'EVAL_END'),
    calibStart: date(src, 'CALIB_START'),
    calibEnd: date(src, 'CALIB_END'),
    offlineAfterSec: num(src, 'DEVICE_OFFLINE_AFTER_SEC', 30),
  };
}
