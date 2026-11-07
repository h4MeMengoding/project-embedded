import { describe, it, expect } from 'vitest';
import { resolveRange } from '../src/lib/range';

const now = new Date('2026-11-07T12:00:00Z');
const H = 3600_000;

describe('resolveRange', () => {
  it('6h', () => {
    const r = resolveRange({ range: '6h' }, now);
    expect(r.to.getTime() - r.from.getTime()).toBe(6 * H);
    expect(r.preset).toBe('6h');
  });
  it('default 24h', () => {
    const r = resolveRange({}, now);
    expect(r.to.getTime() - r.from.getTime()).toBe(24 * H);
    expect(r.preset).toBe('24h');
  });
  it('7d', () => expect(resolveRange({ range: '7d' }, now).to.getTime() - resolveRange({ range: '7d' }, now).from.getTime()).toBe(168 * H));
  it('custom ok', () => {
    const r = resolveRange({ from: '2026-11-01T00:00:00Z', to: '2026-11-03T00:00:00Z' }, now);
    expect(r.preset).toBe('custom');
    expect(r.to.getTime() - r.from.getTime()).toBe(48 * H);
  });
  it('from after to -> default', () => {
    const r = resolveRange({ from: '2026-11-05T00:00:00Z', to: '2026-11-01T00:00:00Z' }, now);
    expect(r.preset).toBe('24h');
  });
  it('40 days -> default', () => {
    const r = resolveRange({ from: '2026-09-01T00:00:00Z', to: '2026-10-11T00:00:00Z' }, now);
    expect(r.preset).toBe('24h');
  });
  it('invalid ISO -> default', () => expect(resolveRange({ from: 'x', to: 'y' }, now).preset).toBe('24h'));
});
