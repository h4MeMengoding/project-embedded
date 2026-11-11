'use client';
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatWib } from '@ws/core';
import { niceAxis, tickDayLabels, timeTicks, type SeriesRow } from '../../lib/series';

export type SeriesDef = { key: string; label: string; color: string };

const nf = (d: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

type TickProps = { x?: number; y?: number; payload?: { value: number }; labels: Map<number, string | null> };
function TimeTick({ x = 0, y = 0, payload, labels }: TickProps) {
  const t = payload!.value;
  const date = labels.get(t);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" dy={16} fontSize={12} fill="var(--ink)">{formatWib(new Date(t), 'time')}</text>
      {date && <text textAnchor="middle" dy={30} fontSize={11} fontWeight={700} fill="var(--muted)">{date}</text>}
    </g>
  );
}

export function SeriesChart({ title, unit, data, series, rainIntervals, from, to, yStep, yDomain, yTicks, include, refLines = [], digits = 1, tipDigits, syncId = 'riwayat' }: {
  title: string;
  unit: string;
  data: SeriesRow[];
  series: SeriesDef[];
  rainIntervals: { start: number; end: number }[];
  from: number;
  to: number;
  yStep?: number;
  yDomain?: [number, number];
  yTicks?: number[];
  include?: number[];
  refLines?: { y: number; label: string }[];
  digits?: number;
  tipDigits?: number;
  syncId?: string;
}) {
  const ticks = timeTicks(from, to);
  const labels = tickDayLabels(ticks);
  const hasData = data.some((r) => series.some((s) => r[s.key] != null));
  const axis = yStep ? niceAxis(data.flatMap((r) => series.map((s) => r[s.key])), yStep, include) : null;
  const domain = yDomain ?? axis?.domain ?? (['auto', 'auto'] as const);
  const yt = yTicks ?? axis?.ticks;
  return (
    <section className="card light">
      <h3>{title}</h3>
      <div className="sub">{unit} · area biru menandai periode hujan{refLines.length ? ' · garis putus-putus menandai ambang' : ''}</div>
      {!hasData ? (
        <p style={{ marginTop: 20 }}>Data tidak tersedia pada rentang ini</p>
      ) : (
        <div style={{ height: 260, marginTop: 16 }} role="img" aria-label={`Grafik ${title}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId={syncId} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--card2)" />
              <XAxis dataKey="t" type="number" scale="time" domain={[from, to]} ticks={ticks} tick={<TimeTick labels={labels} />} height={44} interval={0} />
              <YAxis domain={domain as [number, number]} ticks={yt} tickFormatter={(v: number) => nf(digits).format(v)} tick={{ fontSize: 12, fill: 'var(--ink)' }} width={56} />
              {rainIntervals.map((r, i) => (
                <ReferenceArea key={i} x1={r.start} x2={r.end} fill="#2c7fb0" fillOpacity={0.18} ifOverflow="hidden" />
              ))}
              {refLines.map((l) => (
                <ReferenceLine key={l.label} y={l.y} stroke="#d99a00" strokeWidth={1.5} strokeDasharray="5 5" label={{ value: l.label, position: 'insideTopRight', fontSize: 12, fill: '#a87400' }} />
              ))}
              <Tooltip labelFormatter={(t) => `${formatWib(new Date(Number(t)), 'datetime')} WIB`} formatter={(v) => (typeof v === 'number' ? nf(tipDigits ?? digits).format(v) : v)} />
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
