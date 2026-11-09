import { eq } from 'drizzle-orm';
import { parseIngestPayload } from '@ws/core';
import { devices, ingestPayload, verifyToken } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { createRateLimiter } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Per IP sebelum autentikasi (agar orang lain tidak bisa menghabiskan kuota perangkat asli),
// per perangkat sesudah token valid. Perangkat normal: 1 request/menit, backfill maks 20/menit.
const limitIp = createRateLimiter({ windowMs: 60_000, max: 60 });
const limitDevice = createRateLimiter({ windowMs: 60_000, max: 30 });
const MAX_BODY = 64 * 1024;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

/** ESP32 → server. Header `Authorization: Bearer <token>`. 200 = semua record tersimpan (duplikat diabaikan). */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rlIp = limitIp(ip);
  if (!rlIp.allowed) return json({ ok: false, error: 'Terlalu sering' }, 429, { 'Retry-After': String(rlIp.retryAfterSec) });
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ ok: false, error: 'payload terlalu besar' }, 413);
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY) return json({ ok: false, error: 'payload terlalu besar' }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'JSON tidak valid' }, 400); }

  const nowMs = Date.now();
  const parsed = parseIngestPayload(body, Math.floor(nowMs / 1000));
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const p = parsed.value;

  const token = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? '';
  const db = getDb();
  const [dev] = await db.select({ tokenHash: devices.tokenHash }).from(devices).where(eq(devices.id, p.device_id));
  if (!dev || !verifyToken(token, dev.tokenHash)) return json({ ok: false, error: 'token tidak valid' }, 401);
  const rl = limitDevice(p.device_id);
  if (!rl.allowed) return json({ ok: false, error: 'Terlalu sering' }, 429, { 'Retry-After': String(rl.retryAfterSec) });

  const r = await ingestPayload(db, p.device_id, p, new Date(nowMs), getEnv().predictThreshold);
  return json({ ok: true, ...r, server_time: Math.floor(Date.now() / 1000) });
}
