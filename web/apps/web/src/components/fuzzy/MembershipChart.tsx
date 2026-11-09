'use client';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { trap, tri, type Shape } from '@ws/core';

const COLORS = ['#2c7fb0', '#e0a21a', '#d1553b'];

const fn = (s: Shape) => (s.kind === 'trap' ? trap(...s.p) : tri(...s.p));

export function MembershipChart({ title, unit, universe, sets }: {
  title: string;
  unit: string;
  universe: [number, number];
  sets: Record<string, Shape>;
}) {
  const [lo, hi] = universe;
  const n = 200;
  const fns = Object.entries(sets).map(([k, s]) => [k, fn(s)] as const);
  const data = Array.from({ length: n + 1 }, (_, i) => {
    const x = lo + ((hi - lo) * i) / n;
    return { x, ...Object.fromEntries(fns.map(([k, f]) => [k, f(x)])) };
  });
  return (
    <figure className="card light" data-aos="fade-up" style={{ margin: 0 }}>
      <h3>{title}</h3>
      <div className="sub">Derajat keanggotaan terhadap {unit}</div>
      <div style={{ height: 260, marginTop: 16 }} role="img" aria-label={`Grafik fungsi keanggotaan ${title}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="var(--card2)" />
            <XAxis dataKey="x" type="number" domain={[lo, hi]} tick={{ fontSize: 13, fill: 'var(--ink)' }} label={{ value: unit, position: 'insideBottom', offset: -10, fontSize: 13, fill: 'var(--ink)' }} />
            <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 13, fill: 'var(--ink)' }} />
            <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 13 }} />
            {fns.map(([k], i) => (
              <Line key={k} dataKey={k} stroke={COLORS[i % 3]} strokeWidth={3} dot={false} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
