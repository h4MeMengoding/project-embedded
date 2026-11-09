import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { parseIngestPayload, type IngestPayload } from '@ws/core';
import { lastLive, publish, publishLive, subscribe } from './liveHub';
import { createRateLimiter } from './rateLimit';

// WebSocket di proses web yang sama dengan Next.js (lihat server.ts).
//   /ws/device  ESP32 → server. Pesan pertama `hello` (device_id + token), sesudahnya payload ingest:
//               {id?, device_id, fw, status, live, records[]}. Jika `id` ada, server membalas ack/nack setelah DB.
//   /ws/live    server → browser, hanya baca: event live / minute / offline dari liveHub.

export type WsDeps = {
  /** Perangkat yang diikuti dashboard. */
  deviceId: string;
  offlineAfterSec: number;
  tokenHash: (deviceId: string) => Promise<string | null>;
  verifyToken: (token: string, hash: string) => boolean;
  ingest: (p: IngestPayload, now: Date) => Promise<{ stored: number; duplicates: number }>;
};

const MAX_PAYLOAD = 64 * 1024;
const HELLO_TIMEOUT_MS = 5000;
const PING_MS = 15_000;

// Per IP sebelum autentikasi; per perangkat sesudahnya (heartbeat 6/menit + backfill ≤ 20/menit).
const limitIp = createRateLimiter({ windowMs: 60_000, max: 60 });
const limitDevice = createRateLimiter({ windowMs: 60_000, max: 120 });

const send = (ws: WebSocket, m: unknown) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

function onDevice(ws: WebSocket, deps: WsDeps, sockets: Map<string, WebSocket>) {
  let dev: string | null = null;
  const helloTimer = setTimeout(() => ws.close(4401, 'hello timeout'), HELLO_TIMEOUT_MS);

  async function handle(raw: string) {
    let m: any;
    try { m = JSON.parse(raw); } catch { return send(ws, { type: 'error', error: 'JSON tidak valid' }); }

    if (!dev) {
      const hash = m?.type === 'hello' && typeof m.device_id === 'string' && typeof m.token === 'string'
        ? await deps.tokenHash(m.device_id) : null;
      if (!hash || !deps.verifyToken(m.token, hash)) {
        send(ws, { type: 'error', error: 'hello/token tidak valid' });
        return ws.close(4401, 'unauthorized');
      }
      clearTimeout(helloTimer);
      dev = m.device_id as string;
      sockets.get(dev)?.close(4000, 'diganti koneksi baru'); // koneksi lama mungkin yatim (WiFi putus)
      sockets.set(dev, ws);
      return send(ws, { type: 'hello_ack', server_time: Math.floor(Date.now() / 1000) });
    }

    if (!limitDevice(dev).allowed) return ws.close(1008, 'terlalu sering');
    const nowMs = Date.now();
    const id: number | null = Number.isInteger(m?.id) ? m.id : null;
    const nack = (error: string, permanent: boolean) => { if (id != null) send(ws, { type: 'nack', id, error, permanent }); };
    const parsed = parseIngestPayload(m, Math.floor(nowMs / 1000));
    if (!parsed.ok) return nack(parsed.error, true);
    const p = parsed.value;
    if (p.device_id !== dev) return nack('device_id berbeda dari hello', true);

    let r: { stored: number; duplicates: number };
    try { r = await deps.ingest(p, new Date(nowMs)); } catch (e) {
      console.error('[ws] ingest gagal:', e instanceof Error ? e.message : e);
      return nack('server gagal menyimpan', false);
    }

    const l = p.live;
    publishLive({
      type: 'live', deviceId: dev, lastSeenAt: new Date(nowMs).toISOString(), sensors: p.status.sensors,
      reading: l ? {
        ts: new Date(l.ts != null ? l.ts * 1000 : nowMs).toISOString(), tempDht: l.temp_dht, humDht: l.hum_dht,
        pressureHpa: l.pressure_hpa, lux: l.lux, rainWetSeconds: l.rain_wet ? 60 : 0,
      } : null,
    }, deps.offlineAfterSec);
    if (r.stored > 0 && p.records.some((x) => x.type === 'minute')) publish({ type: 'minute', deviceId: dev });
    if (id != null) send(ws, { type: 'ack', id, ...r });
  }

  // Berurutan: ack mengikuti urutan kirim dan DB tidak ditulis paralel oleh satu perangkat.
  let queue: Promise<unknown> = Promise.resolve();
  ws.on('message', (data) => {
    queue = queue.then(() => handle(data.toString())).catch((e) => console.error('[ws] error:', e));
  });
  ws.on('close', () => {
    clearTimeout(helloTimer);
    if (dev && sockets.get(dev) === ws) sockets.delete(dev);
  });
}

function onLive(ws: WebSocket, deps: WsDeps) {
  const last = lastLive(deps.deviceId);
  if (last) send(ws, last);
  const off = subscribe((e) => { if (e.deviceId === deps.deviceId) send(ws, e); });
  ws.on('close', off);
}

export type Fallback = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

/** Pasang /ws/device dan /ws/live ke server HTTP. Upgrade lain (mis. HMR dev Next) diteruskan ke `fallback`. */
export function attachWebSockets(server: Server, deps: WsDeps, fallback?: Fallback): { close: () => void } {
  const device = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  const live = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const sockets = new Map<string, WebSocket>();
  device.on('connection', (ws) => onDevice(ws, deps, sockets));
  live.on('connection', (ws) => onLive(ws, deps));

  const alive = new WeakSet<WebSocket>();
  for (const wss of [device, live]) wss.on('connection', (ws) => { alive.add(ws); ws.on('pong', () => alive.add(ws)); });
  const pinger = setInterval(() => {
    for (const ws of [...device.clients, ...live.clients]) {
      if (!alive.delete(ws)) { ws.terminate(); continue; } // tidak membalas ping sejak ping lalu
      ws.ping();
    }
  }, PING_MS);
  pinger.unref();

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (path === '/ws/device') {
      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
      if (!limitIp(ip).allowed) { socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return; }
      device.handleUpgrade(req, socket, head, (ws) => device.emit('connection', ws, req));
    } else if (path === '/ws/live') {
      live.handleUpgrade(req, socket, head, (ws) => live.emit('connection', ws, req));
    } else if (fallback) fallback(req, socket, head);
    else socket.destroy();
  });

  return { close: () => { clearInterval(pinger); for (const ws of [...device.clients, ...live.clients]) ws.terminate(); device.close(); live.close(); } };
}
