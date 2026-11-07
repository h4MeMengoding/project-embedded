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

  it('prunes expired keys', () => {
    let t = 0;
    const rl = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
    for (let i = 0; i < 50; i++) rl(`k${i}`);
    expect(rl.size()).toBe(50);
    t += 2000;
    rl('fresh');
    expect(rl.size()).toBe(1);
  });
});
