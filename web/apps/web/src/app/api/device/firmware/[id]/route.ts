import { eq } from 'drizzle-orm';
import { devices, getFirmware, verifyToken } from '@ws/db';
import { getDb } from '@/lib/db';
import { createRateLimiter } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
const limit = createRateLimiter({ windowMs: 60_000, max: 10 });

// ESP32 mengunduh firmware: header X-Device-Id dan Authorization: Bearer <DEVICE_TOKEN>.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deviceId = req.headers.get('x-device-id') ?? '';
  const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '';
  if (!limit(deviceId || 'anon').allowed) return new Response('Terlalu sering', { status: 429 });
  const [dev] = deviceId ? await getDb().select({ h: devices.tokenHash }).from(devices).where(eq(devices.id, deviceId)) : [];
  if (!dev || !token || !verifyToken(token, dev.h)) return new Response('Tidak diizinkan', { status: 401 });
  const id = Number((await params).id);
  const fw = Number.isInteger(id) ? await getFirmware(getDb(), id) : null;
  if (!fw) return new Response('Firmware tidak ditemukan', { status: 404 });
  return new Response(new Uint8Array(fw.data), {
    // Next membuang Content-Length (respons chunked); firmware ESP32 menanganinya lewat HTTPClient::writeToStream.
    headers: { 'Content-Type': 'application/octet-stream' },
  });
}
