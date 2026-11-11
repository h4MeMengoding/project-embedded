import { getMode, getSetting, setMode } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { isRegionLocked, requestIsAdmin } from '@/lib/adminAuth';
import { runActiveBmkgJob } from '@/lib/jobs';
import { invalidateMode } from '@/lib/mode';

export const dynamic = 'force-dynamic';

const err = (error: string, status: number, extra: object = {}) => Response.json({ error, ...extra }, { status });

export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return err('Perlu login admin.', 401);
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode;
  if (mode !== 'dev' && mode !== 'prod') return err('Mode harus dev atau prod.', 400);
  const db = getDb();
  const env = getEnv();
  if (mode === 'dev' && isRegionLocked(env.evalStart, new Date())) {
    return err('Periode evaluasi sudah dimulai (EVAL_START); dev mode akan membuang data penelitian.', 403);
  }
  // Prod butuh wilayah BMKG (tanpa itu prakiraan tidak bisa diambil dan dibandingkan).
  const adm4 = await getSetting(db, 'bmkg_adm4');
  if (mode === 'prod' && !adm4 && (!env.adm4 || env.adm4 === 'SEED')) {
    return err('Pilih wilayah BMKG dulu untuk mengaktifkan mode produksi.', 409, { needRegion: true });
  }
  const was = await getMode(db);
  await setMode(db, mode);
  invalidateMode();
  if (mode === 'prod' && was === 'dev') void runActiveBmkgJob().catch(() => {});
  return Response.json({ ok: true, mode });
}
