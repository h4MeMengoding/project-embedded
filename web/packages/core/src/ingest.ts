/** Validasi payload perangkat (pesan WebSocket /ws/device, ESP32 → server). Murni, tanpa I/O. */

export type SensorFlags = { dht22: boolean; bmp280: boolean; bh1750: boolean; rain: boolean };
export type IngestStatus = {
  ts: number | null; rssi: number; uptime_s: number; heap_free: number; backlog: number;
  buffer_full: boolean; time_valid: boolean; sensors: SensorFlags;
  /** IPv4 perangkat di LAN; null jika firmware lama tidak melaporkannya. */
  ip: string | null;
};
export type MinuteRecord = {
  type: 'minute'; ts: number; temp_dht: number | null; hum_dht: number | null; temp_bmp: number | null;
  pressure_hpa: number | null; lux: number | null; rain_analog_avg: number | null;
  rain_wet_seconds: number; samples: number; backfill: boolean;
};
export type RainEventRecord = { type: 'rain_event'; ts: number; state: 'start' | 'stop'; backfill: boolean };
export type IngestRecord = MinuteRecord | RainEventRecord;
/** Sampel 10 detik terakhir untuk tampilan realtime (tidak disimpan ke database). */
export type LiveSample = {
  ts: number | null; temp_dht: number | null; hum_dht: number | null; temp_bmp: number | null;
  pressure_hpa: number | null; lux: number | null; rain_analog: number | null; rain_wet: boolean;
};
export type IngestPayload = { device_id: string; fw: string; status: IngestStatus; records: IngestRecord[]; live: LiveSample | null };

export const INGEST_MAX_RECORDS = 60;
const MIN_TS = 1735689600; // 2025-01-01T00:00:00Z: sebelum ini jam perangkat belum valid

class Bad extends Error {}
type Obj = Record<string, unknown>;
const obj = (v: unknown, name: string): Obj => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Bad(`${name} harus objek`);
  return v as Obj;
};
const num = (o: Obj, k: string, lo = -Infinity, hi = Infinity): number => {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new Bad(`${k} tidak valid`);
  return v;
};
const int = (o: Obj, k: string, lo: number, hi: number): number => {
  const v = num(o, k, lo, hi);
  if (!Number.isInteger(v)) throw new Bad(`${k} harus bilangan bulat`);
  return v;
};
const INT_MAX = 2 ** 31 - 1;
const numN = (o: Obj, k: string, lo: number, hi: number): number | null => (o[k] == null ? null : num(o, k, lo, hi));
const bool = (o: Obj, k: string, def?: boolean): boolean => {
  const v = o[k];
  if (v === undefined && def !== undefined) return def;
  if (typeof v !== 'boolean') throw new Bad(`${k} harus boolean`);
  return v;
};
const str = (o: Obj, k: string, max: number): string => {
  const v = o[k];
  if (typeof v !== 'string' || v.length === 0 || v.length > max) throw new Bad(`${k} tidak valid`);
  return v;
};

export function parseIngestPayload(body: unknown, nowSec: number):
  { ok: true; value: IngestPayload } | { ok: false; error: string } {
  try {
    const b = obj(body, 'body');
    const s = obj(b.status, 'status');
    const sn = obj(s.sensors, 'sensors');
    const status: IngestStatus = {
      ts: s.ts == null ? null : int(s, 'ts', 0, nowSec + 86400),
      rssi: int(s, 'rssi', -127, 0), uptime_s: int(s, 'uptime_s', 0, INT_MAX), heap_free: int(s, 'heap_free', 0, INT_MAX),
      backlog: int(s, 'backlog', 0, INT_MAX), buffer_full: bool(s, 'buffer_full'), time_valid: bool(s, 'time_valid'),
      sensors: { dht22: bool(sn, 'dht22'), bmp280: bool(sn, 'bmp280'), bh1750: bool(sn, 'bh1750'), rain: bool(sn, 'rain') },
      ip: typeof s.ip === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(s.ip) ? s.ip : null,
    };
    if (!Array.isArray(b.records)) throw new Bad('records harus array');
    if (b.records.length > INGEST_MAX_RECORDS) throw new Bad(`maksimal ${INGEST_MAX_RECORDS} record`);
    const maxTs = nowSec + 600;
    const records = b.records.map((raw, i): IngestRecord => {
      const r = obj(raw, `records[${i}]`);
      const ts = int(r, 'ts', MIN_TS, maxTs);
      const backfill = bool(r, 'backfill', false);
      if (r.type === 'rain_event') {
        if (r.state !== 'start' && r.state !== 'stop') throw new Bad('state harus start atau stop');
        return { type: 'rain_event', ts, state: r.state, backfill };
      }
      if (r.type !== 'minute') throw new Bad(`records[${i}].type tidak dikenal`);
      if (ts % 60 !== 0) throw new Bad('ts minute harus awal menit');
      return {
        type: 'minute', ts, backfill,
        temp_dht: numN(r, 'temp_dht', -40, 80), hum_dht: numN(r, 'hum_dht', 0, 100),
        temp_bmp: numN(r, 'temp_bmp', -40, 85), pressure_hpa: numN(r, 'pressure_hpa', 300, 1100),
        lux: numN(r, 'lux', 0, 200000), rain_analog_avg: numN(r, 'rain_analog_avg', 0, 4095),
        rain_wet_seconds: int(r, 'rain_wet_seconds', 0, 60), samples: int(r, 'samples', 0, 6),
      };
    });
    let live: LiveSample | null = null;
    if (b.live != null) {
      const l = obj(b.live, 'live');
      live = {
        ts: l.ts == null ? null : int(l, 'ts', MIN_TS, maxTs),
        temp_dht: numN(l, 'temp_dht', -40, 80), hum_dht: numN(l, 'hum_dht', 0, 100),
        temp_bmp: numN(l, 'temp_bmp', -40, 85), pressure_hpa: numN(l, 'pressure_hpa', 300, 1100),
        lux: numN(l, 'lux', 0, 200000), rain_analog: numN(l, 'rain_analog', 0, 4095), rain_wet: bool(l, 'rain_wet'),
      };
    }
    return { ok: true, value: { device_id: str(b, 'device_id', 64), fw: str(b, 'fw', 32), status, records, live } };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}
