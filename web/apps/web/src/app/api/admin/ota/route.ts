import { getFirmware } from '@ws/db';
import { requestIsAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';
import { sendToDevice } from '@/lib/deviceLink';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Perintahkan perangkat yang sedang online mengunduh firmware lalu restart. Hanya admin.
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return Response.json({ error: 'Login admin diperlukan.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.firmwareId);
  const fw = Number.isInteger(id) ? await getFirmware(getDb(), id) : null;
  if (!fw) return Response.json({ error: 'Firmware tidak ditemukan.' }, { status: 404 });
  const sent = sendToDevice(getEnv().deviceId, {
    type: 'ota', path: `/api/device/firmware/${fw.id}`, size: fw.size, md5: fw.md5, version: fw.version,
  });
  if (!sent) return Response.json({ error: 'Perangkat sedang tidak tersambung. Coba lagi saat online.' }, { status: 409 });
  return Response.json({ ok: true });
}
