import { timingSafeEqual } from 'node:crypto';
import { ADMIN_COOKIE, sessionValue } from '@/lib/adminAuth';
import { createRateLimiter } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
const limit = createRateLimiter({ windowMs: 60_000, max: 5 });

const cookie = (value: string, maxAge: number) =>
  `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rl = limit(ip);
  if (!rl.allowed) return Response.json({ error: `Terlalu banyak percobaan. Ulangi dalam ${rl.retryAfterSec} detik.` }, { status: 429 });
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return Response.json({ error: 'ADMIN_PASSWORD belum diisi di server.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const given = Buffer.from(typeof body?.password === 'string' ? body.password : '');
  const want = Buffer.from(pw);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return Response.json({ error: 'Password salah.' }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie(sessionValue(pw), 30 * 86400) } });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie('', 0) } });
}
