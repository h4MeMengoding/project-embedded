'use client';
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatWib } from '@ws/core';

export type SeriesDef = { key: string; label: string; color: string };
type Row = { t: number } & Record<string, number | null>;

export function SeriesChart({ title, unit, data, series, rainIntervals, spanMs }: {
  title: string;
  unit: string;
  data: Row[];
  series: SeriesDef[];
  rainIntervals: { start: number; end: number }[];
  spanMs: number;
}) {
  const fmt = (t: number) => formatWib(new Date(t), spanMs > 36 * 3600_000 ? 'datetime' : 'time');
  return (
    <section className="card light">
      <h3>{title}</h3>
      <div className="sub">{unit} · area biru muda = hujan</div>
      {data.length === 0 ? (
        <p style={{ marginTop: 20 }}>Tidak ada data pada rentang ini</p>
      ) : (
        <div style={{ height: 240, marginTop: 16 }} role="img" aria-label={`Grafik ${title}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--card2)" />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt} tick={{ fontSize: 13, fill: 'var(--ink)' }} minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 13, fill: 'var(--ink)' }} width={52} />
              {rainIntervals.map((r, i) => (
                <ReferenceArea key={i} x1={r.start} x2={r.end} fill="#2c7fb0" fillOpacity={0.18} ifOverflow="hidden" />
              ))}
              <Tooltip labelFormatter={(t) => `${fmt(Number(t))} WIB`} formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
              {series.map((s) => (
                <Line key={s.key} name={s.label} dataKey={s.key} stroke={s.color} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
