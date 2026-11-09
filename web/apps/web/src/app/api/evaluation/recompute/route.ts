import { getDb } from '@/lib/db';
import { runEvaluationJob } from '@/lib/jobs';
import { createRateLimiter } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
const limit = createRateLimiter({ windowMs: 60_000, max: 1 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rl = limit(ip);
  if (!rl.allowed) {
    return Response.json({ error: 'Terlalu sering', retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  }
  const res = await runEvaluationJob(getDb());
  return Response.json(res);
}
