export function createRateLimiter(opts: { windowMs: number; max: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, { count: number; resetAt: number }>();
  const limiter = (key: string): { allowed: boolean; retryAfterSec: number } => {
    const t = now();
    for (const [k, v] of hits) if (t >= v.resetAt) hits.delete(k);
    const e = hits.get(key);
    if (!e || t >= e.resetAt) {
      hits.set(key, { count: 1, resetAt: t + opts.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    if (e.count < opts.max) {
      e.count++;
      return { allowed: true, retryAfterSec: 0 };
    }
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((e.resetAt - t) / 1000)) };
  };
  return Object.assign(limiter, { size: () => hits.size });
}
