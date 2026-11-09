import { describe, it, expect } from 'vitest';
import { bucketSeries, niceAxis, tickDayLabels, timeTicks } from '../src/lib/series';

const MIN = 60_000;
const H = 3_600_000;
const wibHour = (t: number) => new Date(t + 7 * H).getUTCHours();
const T0 = Date.UTC(2026, 10, 7, 0, 0); // 07.00 WIB

describe('bucketSeries', () => {
  it('menghitung rata-rata per bucket dan mengisi null pada celah', () => {
    const rows = [0, 1, 2, 10, 11].map((m) => ({ t: T0 + m * MIN, v: m < 5 ? 10 + m : 100 }));
    const out = bucketSeries(rows, ['v'], T0, T0 + 12 * MIN);
    expect(out).toHaveLength(12);
    expect(out[1].v).toBe(11);
    expect(out[5].v).toBeNull(); // celah (offline) tetap null
    expect(out[10].v).toBe(100);
  });
  it('mengecilkan titik tanpa menghilangkan celah panjang', () => {
    const from = T0, to = T0 + 7 * 24 * H;
    const rows = [] as { t: number; v: number }[];
    for (let t = from; t < to; t += MIN) if (t < from + 24 * H || t >= from + 30 * H) rows.push({ t, v: 1 });
    const out = bucketSeries(rows, ['v'], from, to);
    expect(out.length).toBeLessThanOrEqual(1200);
    expect(out.filter((r) => r.v == null).length).toBeGreaterThan(0);
    const gapBuckets = out.filter((r) => r.t >= from + 25 * H && r.t < from + 29 * H);
    expect(gapBuckets.every((r) => r.v == null)).toBe(true);
  });
  it('dua deret dengan rentang sama menghasilkan grid identik', () => {
    const a = bucketSeries([{ t: T0, v: 1 }], ['v'], T0, T0 + 24 * H);
    const b = bucketSeries([{ t: T0 + 5 * H, w: 2 }], ['w'], T0, T0 + 24 * H);
    expect(a.map((r) => r.t)).toEqual(b.map((r) => r.t));
  });
});

describe('timeTicks', () => {
  it('24 jam: kelipatan 3 jam sejajar slot BMKG (01, 04, 07, ...)', () => {
    const ticks = timeTicks(T0 + 20 * 60 * MIN + 17 * MIN, T0 + 20 * 60 * MIN + 17 * MIN + 24 * H);
    expect(ticks.length).toBeLessThanOrEqual(8);
    for (const t of ticks) expect([1, 4, 7, 10, 13, 16, 19, 22]).toContain(wibHour(t));
  });
  it('6 jam: tiap jam bulat', () => {
    const ticks = timeTicks(T0 + 13 * MIN, T0 + 13 * MIN + 6 * H);
    expect(ticks).toHaveLength(6);
    expect(ticks.every((t) => (t + 7 * H) % H === 0)).toBe(true);
  });
  it('7 hari: tick harian 01.00 dan selalu berlabel tanggal', () => {
    const ticks = timeTicks(T0, T0 + 7 * 24 * H);
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks.every((t) => wibHour(t) === 1)).toBe(true);
    expect([...tickDayLabels(ticks).values()].every((v) => v != null)).toBe(true);
  });
  it('tanggal muncul saat hari berganti pada rentang 24 jam', () => {
    const labels = tickDayLabels(timeTicks(T0 + 3 * H, T0 + 27 * H));
    const withDate = [...labels.values()].filter((v) => v != null);
    expect(withDate.length).toBe(2); // tick pertama dan pergantian hari
  });
});

describe('niceAxis', () => {
  it('tick tekanan kelipatan 0,5', () => {
    const a = niceAxis([984.12, 985.31, 986.87], 0.5)!;
    expect(a.domain).toEqual([984, 987]);
    expect(a.ticks).toEqual([984, 984.5, 985, 985.5, 986, 986.5, 987]);
  });
  it('melipatgandakan langkah bila terlalu rapat dan menyertakan nilai include', () => {
    const a = niceAxis([-1, 3], 0.5, [0])!;
    expect(a.ticks.length).toBeLessThanOrEqual(8);
    expect(a.ticks).toContain(0);
  });
  it('null bila tidak ada data', () => expect(niceAxis([null], 0.5)).toBeNull());
});
