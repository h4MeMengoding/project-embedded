import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'ws_admin';

/** Nilai cookie sesi admin: HMAC dari ADMIN_PASSWORD. Mengganti password otomatis membatalkan sesi lama. */
export function sessionValue(password: string): string {
  return createHmac('sha256', password).update('ws-admin-v1').digest('hex');
}

export function isAdmin(cookieValue: string | undefined, password: string | undefined): boolean {
  if (!password || !cookieValue) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(sessionValue(password));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Integritas penelitian: wilayah BMKG tidak boleh diganti setelah periode evaluasi dimulai. */
export function isRegionLocked(evalStart: Date | null, now: Date): boolean {
  return evalStart != null && now.getTime() >= evalStart.getTime();
}

/** Untuk route handler: cek cookie admin dari request. */
export function requestIsAdmin(req: Request): boolean {
  const c = req.headers.get('cookie') ?? '';
  const v = c.split(/;\s*/).find((p) => p.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  return isAdmin(v, process.env.ADMIN_PASSWORD);
}
