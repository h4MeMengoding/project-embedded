import { describe, it, expect } from 'vitest';
import { selectCurrentSlots } from '../src/lib/currentSlots';
import { isOnline } from '../src/lib/online';

const f = (iso: string) => ({ utcDatetime: new Date(iso), id: iso });

describe('selectCurrentSlots', () => {
  // BMKG-style 01/04/07 UTC alignment
  const rows = ['2026-11-07T22:00:00Z', '2026-11-08T01:00:00Z', '2026-11-08T04:00:00Z', '2026-11-08T07:00:00Z'].map(f);
  it('picks slot containing now (start mode), not the next one', () => {
    const r = selectCurrentSlots(rows, new Date('2026-11-08T00:30:00Z'), 'start', 3);
    expect(r.map((x) => x.id)).toEqual(['2026-11-07T22:00:00Z', '2026-11-08T01:00:00Z', '2026-11-08T04:00:00Z']);
  });
  it('center mode', () => {
    const r = selectCurrentSlots(rows, new Date('2026-11-08T00:30:00Z'), 'center', 2);
    expect(r[0].id).toBe('2026-11-08T01:00:00Z'); // [23.30, 02.30) contains 00.30
  });
  it('none containing -> first upcoming', () => {
    expect(selectCurrentSlots(rows.slice(2), new Date('2026-11-07T00:00:00Z'), 'start', 2)).toHaveLength(2);
  });
});

describe('isOnline', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  it('online within threshold, offline beyond, offline when never seen', () => {
    expect(isOnline(new Date(now.getTime() - 100_000), now, 180)).toBe(true);
    expect(isOnline(new Date(now.getTime() - 200_000), now, 180)).toBe(false);
    expect(isOnline(null, now, 180)).toBe(false);
  });
});
