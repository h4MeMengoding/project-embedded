import { getDeviceStatus, getLatestPrediction, getLatestReading } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { lastLive } from '@/lib/liveHub';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getEnv();
  const db = getDb();
  const [reading, prediction, device] = await Promise.all([
    getLatestReading(db, env.deviceId),
    getLatestPrediction(db, env.deviceId),
    getDeviceStatus(db, env.deviceId, env.offlineAfterSec, new Date()),
  ]);
  // nilai 10 detik terakhir dari memori lebih baru daripada rata-rata menit di database
  const l = lastLive(env.deviceId)?.reading;
  const latest = l && (!reading || new Date(l.ts) > reading.ts) ? l : reading;
  return Response.json({ reading: latest, prediction, device }, { headers: { 'Cache-Control': 'no-store' } });
}
