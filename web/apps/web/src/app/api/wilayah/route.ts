import { requestIsAdmin } from '@/lib/adminAuth';

// Proxy daftar wilayah Kemendagri (sama dengan kode adm4 BMKG) dari wilayah.id, di-cache 1 hari.
// GET /api/wilayah?level=provinces | regencies&code=33 | districts&code=33.74 | villages&code=33.74.12
const LEVELS: Record<string, RegExp | null> = {
  provinces: null,
  regencies: /^\d{2}$/,
  districts: /^\d{2}\.\d{2}$/,
  villages: /^\d{2}\.\d{2}\.\d{2}$/,
};

export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return Response.json({ error: 'Perlu login admin.' }, { status: 401 });
  const u = new URL(req.url);
  const level = u.searchParams.get('level') ?? '';
  const code = u.searchParams.get('code') ?? '';
  if (!Object.hasOwn(LEVELS, level)) return Response.json({ error: 'level tidak dikenal' }, { status: 400 });
  const re = LEVELS[level];
  if (re && !re.test(code)) return Response.json({ error: 'kode tidak valid' }, { status: 400 });
  try {
    const res = await fetch(`https://wilayah.id/api/${level}${re ? `/${code}` : ''}.json`, {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return Response.json({ error: `wilayah.id HTTP ${res.status}` }, { status: 502 });
    const j = await res.json();
    const data = Array.isArray(j?.data)
      ? j.data.filter((d: unknown): d is { code: string; name: string } =>
          typeof (d as { code?: unknown })?.code === 'string' && typeof (d as { name?: unknown })?.name === 'string')
        .map((d: { code: string; name: string }) => ({ code: d.code, name: d.name }))
      : [];
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, max-age=86400' } });
  } catch {
    return Response.json({ error: 'wilayah.id tidak dapat dihubungi' }, { status: 502 });
  }
}
