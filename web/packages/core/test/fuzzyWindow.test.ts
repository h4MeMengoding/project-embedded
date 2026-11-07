import { describe, it, expect } from 'vitest';
import { computeWindowInputs, type MinuteRow } from '../src/fuzzy';

const at = new Date('2026-11-07T12:00:00Z');
const MIN = 60_000;
const row = (offMin: number, p: number | null, rh = 80, t = 27): MinuteRow => ({
  ts: new Date(at.getTime() + offMin * MIN),
  tempDht: t,
  humDht: rh,
  pressureHpa: p,
});
// window now: offsets -9..0 ; window before: offsets -189..-180
const now = (n: number, p: number) => Array.from({ length: n }, (_, i) => row(-i, p));
const prev = (n: number, p: number) => Array.from({ length: n }, (_, i) => row(-180 - i, p));

describe('computeWindowInputs', () => {
  it('ok with 5 rows each', () => {
    const r = computeWindowInputs([...now(5, 985), ...prev(5, 987)], at);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.deltaP3h).toBeCloseTo(-2, 10);
      expect(r.rh).toBeCloseTo(80, 10);
    }
  });
  it('4 now -> insufficient', () =>
    expect(computeWindowInputs([...now(4, 985), ...prev(5, 987)], at).status).toBe('insufficient_data'));
  it('4 prev -> insufficient', () =>
    expect(computeWindowInputs([...now(5, 985), ...prev(4, 987)], at).status).toBe('insufficient_data'));
  it('null pressure not counted', () => {
    const rows = [...now(5, 985), ...prev(5, 987), row(-5, null), row(-6, null)];
    expect(computeWindowInputs(rows, at).status).toBe('ok');
    const rows2 = [...now(4, 985), row(-5, null), ...prev(5, 987)];
    expect(computeWindowInputs(rows2, at).status).toBe('insufficient_data');
  });
  it('rows after at ignored', () => {
    const rows = [...now(4, 985), row(1, 985), row(2, 985), ...prev(5, 987)];
    expect(computeWindowInputs(rows, at).status).toBe('insufficient_data');
  });
});
