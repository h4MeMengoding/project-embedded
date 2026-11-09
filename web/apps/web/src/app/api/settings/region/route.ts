import { setSetting } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { isRegionLocked, requestIsAdmin } from '@/lib/adminAuth';
import { ADM4_RE, fetchBmkg, runBmkgJob } from '@/lib/bmkgJob';

export const dynamic = 'force-dynamic';

const err = (error: string, status: number) => Response.json({ error }, { status });
const label = (l: { desa: string; kecamatan: string; kotkab: string; provinsi: string }) =>
  `${l.desa}, Kec. ${l.kecamatan}, ${l.kotkab}, ${l.provinsi}`;

async function lookup(adm4: string) {
  try {
    const r = await fetchBmkg(adm4);
    if (r.location.adm4 !== adm4) return { error: `BMKG membalas lokasi lain (${r.location.adm4}) untuk ${adm4}` };
    return { location: r.location, label: label(r.location), forecasts: r.forecasts.length };
  } catch (e) {
    return { error: `BMKG tidak mengembalikan prakiraan untuk ${adm4}: ${e instanceof Error ? e.message : e}` };
  }
}

/** Pratinjau: lokasi menurut BMKG untuk kode yang dipilih (sebelum disimpan). */
export async function GET(req: Request) {
  if (!requestIsAdmin(req)) return err('Perlu login admin.', 401);
  const adm4 = new URL(req.url).searchParams.get('adm4') ?? '';
  if (!ADM4_RE.test(adm4)) return err('Kode wilayah tidak valid.', 400);
  const r = await lookup(adm4);
  return 'error' in r ? err(r.error ?? '', 502) : Response.json(r);
}

export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return err('Perlu login admin.', 401);
  if (isRegionLocked(getEnv().evalStart, new Date())) {
    return err('Periode evaluasi sudah dimulai (EVAL_START); wilayah BMKG dikunci.', 403);
  }
  const body = await req.json().catch(() => ({}));
  const adm4 = typeof body?.adm4 === 'string' ? body.adm4 : '';
  if (!ADM4_RE.test(adm4)) return err('Kode wilayah tidak valid.', 400);
  const r = await lookup(adm4);
  if ('error' in r) return err(r.error ?? '', 502);
  const db = getDb();
  await setSetting(db, 'bmkg_adm4', adm4);
  await setSetting(db, 'bmkg_location', r.label);
  const stored = await runBmkgJob(db, adm4).catch(() => 0);
  return Response.json({ ok: true, adm4, label: r.label, stored });
}
