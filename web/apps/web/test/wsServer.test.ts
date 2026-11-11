import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { IngestPayload } from '@ws/core';
import { attachWebSockets, type WsDeps } from '../src/lib/wsServer';

let server: Server;
let stop: () => void;
let ingest: ReturnType<typeof vi.fn>;
let port = 0;

const deps = (): WsDeps => ({
  deviceId: 'stasiun-t', offlineAfterSec: 30,
  tokenHash: async (id) => (id === 'stasiun-t' ? 'hash' : null),
  verifyToken: (t) => t === 'rahasia',
  ingest: ingest as unknown as WsDeps['ingest'],
});

beforeEach(async () => {
  ingest = vi.fn(async (p: IngestPayload) => ({ stored: p.records.length, duplicates: 0 }));
  server = createServer();
  stop = attachWebSockets(server, deps()).close;
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as AddressInfo).port;
});
afterEach(() => { stop(); server.close(); });

// Menampung semua pesan masuk agar tidak ada yang terlewat antara `open` dan `next()`.
async function open(path: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  const inbox: any[] = [];
  const waiters: ((m: any) => void)[] = [];
  ws.on('message', (d) => { const m = JSON.parse(d.toString()); const w = waiters.shift(); if (w) w(m); else inbox.push(m); });
  const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
  await new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', j); });
  const next = () => new Promise<any>((r) => { const m = inbox.shift(); if (m) r(m); else waiters.push(r); });
  return { ws, next, closed, json: (m: unknown) => ws.send(JSON.stringify(m)) };
}

const minute = (ts: number) => ({
  type: 'minute', ts, temp_dht: null, hum_dht: null, temp_bmp: 27.9, pressure_hpa: 985.3, lux: null,
  rain_analog_avg: 3900, rain_wet_seconds: 0, samples: 6,
});
const body = (extra: Record<string, unknown> = {}) => ({
  device_id: 'stasiun-t', fw: 't',
  status: { ts: null, rssi: -60, uptime_s: 1, heap_free: 1, backlog: 0, buffer_full: false, time_valid: true,
    sensors: { dht22: false, bmp280: true, bh1750: false, rain: true } },
  live: null, records: [], ...extra,
});
const hello = { type: 'hello', device_id: 'stasiun-t', token: 'rahasia' };

describe('/ws/device', () => {
  it('menolak token salah dengan kode 4401', async () => {
    const c = await open('/ws/device');
    c.json({ ...hello, token: 'salah' });
    expect((await c.next()).type).toBe('error');
    expect(await c.closed).toBe(4401);
  });

  it('menolak pesan data sebelum hello', async () => {
    const c = await open('/ws/device');
    c.json(body({ id: 1 }));
    expect(await c.closed).toBe(4401);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('hello, lalu kirim record: ack setelah ingest, dan browser menerima live + minute', async () => {
    const browser = await open('/ws/live');
    const c = await open('/ws/device');
    c.json(hello);
    expect((await c.next()).type).toBe('hello_ack');

    c.json(body({ id: 7, records: [minute(1794234900)] }));
    expect(await c.next()).toEqual({ type: 'ack', id: 7, stored: 1, duplicates: 0 });
    expect(ingest).toHaveBeenCalledTimes(1);
    expect((await browser.next()).type).toBe('live');
    expect(await browser.next()).toEqual({ type: 'minute', deviceId: 'stasiun-t' });
    browser.ws.close();
  });

  it('heartbeat tanpa id tidak dibalas tetapi tetap diproses', async () => {
    const c = await open('/ws/device');
    c.json(hello);
    await c.next();
    c.json(body());
    c.json(body({ id: 2, records: [minute(1794234900)] }));
    expect((await c.next()).id).toBe(2); // pesan pertama (tanpa id) tidak menghasilkan balasan
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('pesan live tanpa record tidak menulis DB lebih dari sekali per 10 detik', async () => {
    const c = await open('/ws/device');
    c.json(hello);
    await c.next();
    for (let i = 0; i < 5; i++) c.json(body());
    c.json(body({ id: 9, records: [minute(1794234900)] })); // record selalu ditulis
    expect((await c.next()).id).toBe(9);
    expect(ingest).toHaveBeenCalledTimes(2); // heartbeat pertama + pesan ber-record
  });

  it('nack permanen untuk payload tidak valid, dan nack tidak permanen jika DB gagal', async () => {
    const c = await open('/ws/device');
    c.json(hello);
    await c.next();
    c.json({ id: 3, device_id: 'stasiun-t' });
    expect(await c.next()).toMatchObject({ type: 'nack', id: 3, permanent: true });
    c.json(body({ id: 4, device_id: 'lain' }));
    expect(await c.next()).toMatchObject({ type: 'nack', id: 4, permanent: true });
    ingest.mockRejectedValueOnce(new Error('db mati'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    c.json(body({ id: 5, records: [minute(1794234900)] }));
    expect(await c.next()).toMatchObject({ type: 'nack', id: 5, permanent: false });
  });

  it('koneksi baru dari perangkat yang sama menggantikan yang lama', async () => {
    const a = await open('/ws/device');
    a.json(hello);
    await a.next();
    const b = await open('/ws/device');
    b.json(hello);
    await b.next();
    expect(await a.closed).toBe(4000);
  });
});

describe('/ws/live', () => {
  it('upgrade ke path lain ditolak', async () => {
    await expect(open('/ws/lain')).rejects.toBeDefined();
  });
});

describe('sendToDevice (OTA)', () => {
  it('meneruskan pesan ke perangkat tersambung; false jika tidak ada', async () => {
    const { sendToDevice } = await import('../src/lib/deviceLink');
    expect(sendToDevice('stasiun-t', { type: 'ota' })).toBe(false);
    const d = await open('/ws/device');
    d.json({ type: 'hello', device_id: 'stasiun-t', token: 'rahasia' });
    expect((await d.next()).type).toBe('hello_ack');
    expect(sendToDevice('stasiun-t', { type: 'ota', path: '/x' })).toBe(true);
    expect(await d.next()).toEqual({ type: 'ota', path: '/x' });
    d.ws.close();
  });
});
