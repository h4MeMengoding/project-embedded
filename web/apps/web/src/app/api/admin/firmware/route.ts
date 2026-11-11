import { saveFirmware } from '@ws/db';
import { requestIsAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';
import { checkFirmwareImage, extractVersion, VERSION_RE } from '@/lib/firmware';

export const dynamic = 'force-dynamic';

// Body = isi firmware.bin mentah. Versi dibaca dari penanda FWVER di dalam image (atau ?version= untuk image lama). Hanya admin.
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return Response.json({ error: 'Login admin diperlukan.' }, { status: 401 });
  const data = Buffer.from(await req.arrayBuffer());
  const bad = checkFirmwareImage(data);
  if (bad) return Response.json({ error: bad }, { status: 400 });
  const version = new URL(req.url).searchParams.get('version') || extractVersion(data) || '';
  if (!VERSION_RE.test(version)) return Response.json({ error: 'Versi tidak ditemukan di firmware dan tidak diisi manual.' }, { status: 400 });
  return Response.json(await saveFirmware(getDb(), version, data));
}
