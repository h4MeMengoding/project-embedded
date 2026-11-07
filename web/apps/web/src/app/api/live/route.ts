import { getDeviceStatus, getLatestPrediction, getLatestReading } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getEnv();
  const db = getDb();
  const [reading, prediction, device] = await Promise.all([
    getLatestReading(db, env.deviceId),
    getLatestPrediction(db, env.deviceId),
    getDeviceStatus(db, env.deviceId, env.offlineAfterSec, new Date()),
  ]);
  return Response.json({ reading, prediction, device }, { headers: { 'Cache-Control': 'no-store' } });
}
