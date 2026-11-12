import { requestIsAdmin } from '@/lib/adminAuth';
import { sendToDevice } from '@/lib/deviceLink';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Perintahkan perangkat yang sedang online untuk restart (antrean disimpan ke flash dulu). Hanya admin.
export async function POST(req: Request) {
  if (!requestIsAdmin(req)) return Response.json({ error: 'Login admin diperlukan.' }, { status: 401 });
  if (!sendToDevice(getEnv().deviceId, { type: 'restart' })) {
    return Response.json({ error: 'Perangkat sedang tidak tersambung. Coba lagi saat online.' }, { status: 409 });
  }
  return Response.json({ ok: true });
}
