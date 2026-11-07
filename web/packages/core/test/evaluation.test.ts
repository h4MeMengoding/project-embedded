import { describe, it, expect } from 'vitest';
import {
  slotBounds, labelActualRain, pickFuzzyPrediction, pickBmkgForecast, confusion, metricsOf,
} from '../src/evaluation';

const MIN = 60_000;
const d = (s: string) => new Date(s);

describe('slotBounds', () => {
  it('start', () => {
    const s = slotBounds(d('2026-11-07T14:00:00Z'), 'start');
    expect(s.start).toEqual(d('2026-11-07T14:00:00Z'));
    expect(s.end).toEqual(d('2026-11-07T17:00:00Z'));
  });
  it('center', () => {
    const s = slotBounds(d('2026-11-07T14:00:00Z'), 'center');
    expect(s.start).toEqual(d('2026-11-07T12:30:00Z'));
    expect(s.end).toEqual(d('2026-11-07T15:30:00Z'));
  });
});

describe('labelActualRain', () => {
  const slot = slotBounds(d('2026-11-07T14:00:00Z'), 'start');
  const mk = (n: number, wet: number, wetSec = 60) =>
    Array.from({ length: n }, (_, i) => ({
      ts: new Date(slot.start.getTime() + i * MIN),
      rainWetSeconds: i < wet ? wetSec : 0,
    }));
  it('143 data -> null', () => expect(labelActualRain(mk(143, 20), slot).actualRain).toBeNull());
  it('144 data -> not null', () => expect(labelActualRain(mk(144, 0), slot).actualRain).toBe(false));
  it('9 wet -> false', () => expect(labelActualRain(mk(180, 9), slot).actualRain).toBe(false));
  it('10 wet -> true', () => expect(labelActualRain(mk(180, 10), slot).actualRain).toBe(true));
  it('29s not wet, 30s wet', () => {
    expect(labelActualRain(mk(180, 20, 29), slot).wetMinutes).toBe(0);
    expect(labelActualRain(mk(180, 20, 30), slot).wetMinutes).toBe(20);
  });
  it('ignores minutes outside slot', () => {
    const out = [
      { ts: new Date(slot.start.getTime() - MIN), rainWetSeconds: 60 },
      { ts: slot.end, rainWetSeconds: 60 },
    ];
    const r = labelActualRain([...mk(180, 0), ...out], slot);
    expect(r.dataMinutes).toBe(180);
    expect(r.wetMinutes).toBe(0);
  });
  it('null seconds counted as data not wet', () => {
    const rows = mk(180, 0).map((r) => ({ ...r, rainWetSeconds: null as number | null }));
    const r = labelActualRain(rows, slot);
    expect(r.dataMinutes).toBe(180);
    expect(r.wetMinutes).toBe(0);
  });
});

describe('pickFuzzyPrediction', () => {
  const start = d('2026-11-07T14:00:00Z');
  const p = (offMin: number, status = 'ok') => ({ ts: new Date(start.getTime() + offMin * MIN), status });
  it('exact', () => expect(pickFuzzyPrediction([p(-3), p(0)], start)).toEqual(p(0)));
  it('nearest before within 10', () => expect(pickFuzzyPrediction([p(-10), p(-4)], start)).toEqual(p(-4)));
  it('11 min before -> null', () => expect(pickFuzzyPrediction([p(-11)], start)).toBeNull());
  it('never after', () => expect(pickFuzzyPrediction([p(1), p(5)], start)).toBeNull());
  it('skips insufficient', () =>
    expect(pickFuzzyPrediction([p(0, 'insufficient_data'), p(-2)], start)).toEqual(p(-2)));
});

describe('pickBmkgForecast', () => {
  const fu = d('2026-11-07T14:00:00Z');
  const start = fu;
  const f = (a: string, u = '2026-11-07T14:00:00Z') => ({ analysisDate: d(a), utcDatetime: d(u) });
  it('latest before slotStart', () => {
    const r = pickBmkgForecast(
      [f('2026-11-07T00:00:00Z'), f('2026-11-07T12:00:00Z'), f('2026-11-07T15:00:00Z')], fu, start);
    expect(r).toEqual(f('2026-11-07T12:00:00Z'));
  });
  it('only matching utcDatetime', () => {
    const r = pickBmkgForecast([f('2026-11-07T12:00:00Z', '2026-11-07T17:00:00Z')], fu, start);
    expect(r).toBeNull();
  });
  it('none -> null', () => expect(pickBmkgForecast([], fu, start)).toBeNull());
});

describe('confusion & metrics', () => {
  const rows = (tp: number, fp: number, tn: number, fn: number) => [
    ...Array(tp).fill({ actual: true, predicted: true }),
    ...Array(fp).fill({ actual: false, predicted: true }),
    ...Array(tn).fill({ actual: false, predicted: false }),
    ...Array(fn).fill({ actual: true, predicted: false }),
  ];
  it('3/1/4/2', () => {
    const cm = confusion(rows(3, 1, 4, 2));
    expect(cm).toEqual({ tp: 3, fp: 1, tn: 4, fn: 2 });
    const m = metricsOf(cm);
    expect(m.n).toBe(10);
    expect(m.accuracy).toBeCloseTo(0.7);
    expect(m.precision).toBeCloseTo(0.75);
    expect(m.recall).toBeCloseTo(0.6);
    expect(m.f1).toBeCloseTo(0.667, 3);
  });
  it('all negative -> null ratios, accuracy 1', () => {
    const m = metricsOf(confusion(rows(0, 0, 5, 0)));
    expect(m.precision).toBeNull();
    expect(m.recall).toBeNull();
    expect(m.f1).toBeNull();
    expect(m.accuracy).toBe(1);
  });
  it('skips null rows', () => {
    const cm = confusion([
      ...rows(1, 0, 0, 0),
      { actual: null, predicted: true },
      { actual: true, predicted: null },
    ]);
    expect(cm).toEqual({ tp: 1, fp: 0, tn: 0, fn: 0 });
  });
  it('empty -> n 0, accuracy null', () => expect(metricsOf(confusion([])).accuracy).toBeNull());
});
