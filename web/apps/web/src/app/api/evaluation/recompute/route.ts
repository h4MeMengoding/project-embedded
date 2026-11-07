import { recomputeEvaluation } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { createRateLimiter } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
const limit = createRateLimiter({ windowMs: 60_000, max: 1 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rl = limit(ip);
  if (!rl.allowed) {
    return Response.json({ error: 'Terlalu sering', retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  }
  const env = getEnv();
  const res = await recomputeEvaluation(getDb(), {
    deviceId: env.deviceId,
    adm4: env.adm4,
    from: env.evalStart ?? new Date(0),
    to: env.evalEnd ?? new Date(),
    slotMode: env.slotMode,
    minWetMinutes: env.rainMinWetMinutes,
    predictThreshold: env.predictThreshold,
  });
  return Response.json(res);
}
