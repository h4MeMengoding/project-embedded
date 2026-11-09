import { describe, it, expect } from 'vitest';
import { computeWindowInputs, tideDelta3h, type MinuteRow } from '../src/fuzzy';
import { FUZZY_CONFIG_V1, FUZZY_CONFIG_V2 } from '../src/fuzzyConfig';

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
    const r = computeWindowInputs([...now(5, 985), ...prev(5, 987)], at, FUZZY_CONFIG_V1);
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

describe('koreksi variasi harian (v2)', () => {
  const tide = FUZZY_CONFIG_V2.pressureTide!;
  const P = (ms: number) => 985 + tide.amplitudeHpa * Math.cos((2 * Math.PI * ((((ms + 7 * 3600_000) % 86_400_000) / 3600_000) - tide.peakHourWib)) / 12);
  // tekanan murni mengikuti variasi harian, diambil di pusat tiap menit
  const series = (at: Date) => Array.from({ length: 200 }, (_, i) => {
    const ts = new Date(at.getTime() - i * MIN);
    return { ts, tempDht: 26, humDht: 86, pressureHpa: P(ts.getTime() + 30_000) } as MinuteRow;
  });
  it('variasi harian murni -> ΔP3h terkoreksi ≈ 0 di semua jam, sedangkan ΔP3h mentah besar', () => {
    let maxRaw = 0;
    for (let h = 0; h < 24; h++) {
      const t = new Date(Date.UTC(2026, 10, 7, h, 30));
      const r = computeWindowInputs(series(t), t);
      expect(r.status).toBe('ok');
      if (r.status === 'ok') {
        expect(Math.abs(r.deltaP3h)).toBeLessThan(0.05);
        maxRaw = Math.max(maxRaw, Math.abs(r.deltaP3hRaw));
      }
    }
    expect(maxRaw).toBeGreaterThan(1.2);
  });
  it('penurunan nyata tetap terlihat setelah koreksi', () => {
    const t = new Date(Date.UTC(2026, 10, 7, 8, 30)); // 15.30 WIB
    const rows = series(t).map((r) => ({ ...r, pressureHpa: (r.pressureHpa as number) - (t.getTime() - r.ts.getTime() < 15 * MIN ? 1.4 : 0) }));
    const r = computeWindowInputs(rows, t);
    expect(r.status === 'ok' && r.deltaP3h).toBeLessThan(-1.2);
  });
  it('tideDelta3h: dini hari turun, pagi naik', () => {
    expect(tideDelta3h(new Date(Date.UTC(2026, 10, 6, 19, 0)), tide)).toBeLessThan(-0.8); // 02.00 WIB
    expect(tideDelta3h(new Date(Date.UTC(2026, 10, 7, 0, 0)), tide)).toBeGreaterThan(0.8); // 07.00 WIB
  });
});
