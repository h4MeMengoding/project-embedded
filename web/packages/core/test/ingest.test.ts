import { describe, it, expect } from 'vitest';
import { parseIngestPayload } from '../src/ingest';

const NOW = 1762500061;
const base = () => ({
  device_id: 'stasiun-01', fw: '1.0.0',
  status: { ts: 1762500060, rssi: -67, uptime_s: 3600, heap_free: 182000, backlog: 0, buffer_full: false, time_valid: true,
    sensors: { dht22: false, bmp280: true, bh1750: false, rain: true } },
  records: [
    { type: 'minute', ts: 1762500000, temp_dht: null, hum_dht: null, temp_bmp: 27.9, pressure_hpa: 985.32,
      lux: null, rain_analog_avg: 3900, rain_wet_seconds: 0, samples: 6, backfill: false },
    { type: 'rain_event', ts: 1762500030, state: 'start', backfill: false },
  ] as Record<string, unknown>[],
});
const err = (b: unknown) => { const r = parseIngestPayload(b, NOW); expect(r.ok).toBe(false); return r; };

describe('parseIngestPayload', () => {
  it('contoh spesifikasi valid', () => {
    const r = parseIngestPayload(base(), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.records).toHaveLength(2);
      expect(r.value.status.sensors.dht22).toBe(false);
    }
  });
  it('backfill default false', () => {
    const b = base(); delete b.records[1].backfill;
    const r = parseIngestPayload(b, NOW);
    expect(r.ok && r.value.records[1].backfill).toBe(false);
  });
  it('records kosong boleh (hanya status)', () => expect(parseIngestPayload({ ...base(), records: [] }, NOW).ok).toBe(true));
  it('ts 0 ditolak', () => { const b = base(); b.records[0].ts = 0; err(b); });
  it('ts jauh di masa depan ditolak', () => { const b = base(); b.records[1].ts = NOW + 601; err(b); });
  it('lebih dari 60 record ditolak', () => {
    const b = base();
    b.records = Array.from({ length: 61 }, (_, i) => ({ type: 'rain_event', ts: 1762500000 + i, state: 'stop' }));
    err(b);
  });
  it('state tidak dikenal ditolak', () => { const b = base(); b.records[1].state = 'x'; err(b); });
  it('angka berupa teks ditolak', () => { const b = base(); b.records[0].temp_dht = 'a'; err(b); });
  it('minute ts bukan awal menit ditolak', () => { const b = base(); b.records[0].ts = 1762500001; err(b); });
  it('rain_wet_seconds > 60 ditolak', () => { const b = base(); b.records[0].rain_wet_seconds = 70; err(b); });
  it('tipe record asing ditolak', () => { const b = base(); b.records[0].type = 'live'; err(b); });
  it('bukan objek ditolak', () => { err(null); err('x'); err({ ...base(), device_id: '' }); });
  it('kolom integer menolak pecahan', () => {
    const a = base(); a.records[0].samples = 5.5; err(a);
    const b = base(); b.records[0].rain_wet_seconds = 10.5; err(b);
    const c = base() as any; c.status.uptime_s = 1.5; err(c);
  });
  it('ip valid disimpan, ip tidak valid/kosong jadi null', () => {
    const ok = (ip: unknown) => { const b = base() as any; b.status.ip = ip; const r = parseIngestPayload(b, 1762500100); return r.ok ? r.value.status.ip : 'ERR'; };
    expect(ok('10.10.1.25')).toBe('10.10.1.25');
    expect(ok('bukan-ip')).toBeNull();
    expect(ok(undefined)).toBeNull();
  });
  it('status.ts di luar rentang ditolak', () => { const b = base() as any; b.status.ts = 1e15; err(b); });
  it('live opsional, nilai sensor terbaru', () => {
    const b = { ...base(), records: [], live: { ts: NOW, temp_dht: null, hum_dht: null, temp_bmp: 27.9, pressure_hpa: 985.3, lux: null, rain_analog: 4095, rain_wet: false } };
    const r = parseIngestPayload(b, NOW);
    expect(r.ok && r.value.live).toEqual(b.live);
    const r2 = parseIngestPayload(base(), NOW);
    expect(r2.ok && r2.value.live).toBeNull();
  });
  it('live dengan nilai di luar rentang ditolak', () => {
    err({ ...base(), live: { ts: NOW, temp_dht: null, hum_dht: 140, temp_bmp: null, pressure_hpa: null, lux: null, rain_analog: 1, rain_wet: false } });
  });
  it('status tanpa sensors ditolak', () => { const b = base() as any; delete b.status.sensors; err(b); });
});
