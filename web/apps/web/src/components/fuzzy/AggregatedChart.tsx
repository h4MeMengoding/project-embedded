'use client';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export function AggregatedChart({ x, mu, centroid }: { x: number[]; mu: number[]; centroid: number }) {
  const data = x.map((xi, i) => ({ x: xi, mu: mu[i] }));
  return (
    <div style={{ height: 240 }} role="img" aria-label={`Grafik agregasi output, centroid ${centroid.toFixed(2)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="var(--card2)" />
          <XAxis dataKey="x" type="number" domain={[0, 100]} tick={{ fontSize: 13, fill: 'var(--ink)' }} label={{ value: 'Peluang hujan (%)', position: 'insideBottom', offset: -10, fontSize: 13, fill: 'var(--ink)' }} />
          <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 13, fill: 'var(--ink)' }} />
          <Area dataKey="mu" stroke="#2c7fb0" fill="#2c7fb0" fillOpacity={0.3} strokeWidth={3} isAnimationActive={false} />
          <ReferenceLine x={centroid} stroke="#d1553b" strokeWidth={3} label={{ value: `centroid ${centroid.toFixed(2)}`, fill: '#d1553b', fontSize: 13, position: 'top' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
