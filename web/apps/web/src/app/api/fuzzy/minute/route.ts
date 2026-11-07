import { computeWindowInputs } from '@ws/core';
import { getSeries } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ts = new Date(new URL(req.url).searchParams.get('ts') ?? '');
  if (Number.isNaN(ts.getTime())) return Response.json({ error: 'ts tidak valid' }, { status: 400 });
  const { readings } = await getSeries(getDb(), getEnv().deviceId, new Date(ts.getTime() - 191 * 60_000), new Date(ts.getTime() + 60_000));
  const w = computeWindowInputs(readings.map((r) => ({ ts: r.ts, tempDht: r.tempDht, humDht: r.humDht, pressureHpa: r.pressureHpa })), ts);
  return Response.json(w);
}
