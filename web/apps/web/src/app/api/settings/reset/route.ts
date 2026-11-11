import { getMode, resetMeasurements } from '@ws/db';
import { getDb } from '@/lib/db';
import { requestIsAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const err = (error: string, status: number) => Response.json({ error }, { status });

/** Hapus semua data pengukuran (untuk mengulang penelitian). Hanya mode prod; wajib kata konfirmasi RESET. */
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return err('Perlu login admin.', 401);
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== 'RESET') return err('Ketik RESET untuk mengonfirmasi.', 400);
  const db = getDb();
  if ((await getMode(db)) !== 'prod') return err('Reset hanya tersedia di mode produksi.', 409);
  await resetMeasurements(db);
  return Response.json({ ok: true });
}
