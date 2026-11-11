import { deleteFirmware } from '@ws/db';
import { requestIsAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Hapus satu image firmware dari server (tidak mengubah firmware yang sudah terpasang di perangkat). Hanya admin.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!requestIsAdmin(req)) return Response.json({ error: 'Login admin diperlukan.' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || !(await deleteFirmware(getDb(), id))) return Response.json({ error: 'Firmware tidak ditemukan.' }, { status: 404 });
  return Response.json({ ok: true });
}
