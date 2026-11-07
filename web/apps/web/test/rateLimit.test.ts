import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../src/lib/rateLimit';

describe('createRateLimiter', () => {
  it('allows first, blocks second, separate keys, resets', () => {
    let t = 1000;
    const rl = createRateLimiter({ windowMs: 60000, max: 1, now: () => t });
    expect(rl('a').allowed).toBe(true);
    const second = rl('a');
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSec).toBeGreaterThan(0);
    expect(rl('b').allowed).toBe(true);
    t += 60001;
    expect(rl('a').allowed).toBe(true);
  });
});
