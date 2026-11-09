import { formatWib, wibDayKey } from '@ws/core';
import { Card } from './Card';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function RainActivityCard({ intervals, now }: { intervals: { start: Date; end: Date }[]; now: Date }) {
  const keys = Array.from({ length: 7 }, (_, i) => wibDayKey(new Date(now.getTime() - (6 - i) * 86400_000)));
  const minutes = new Map<string, number>();
  for (const iv of intervals) {
    const k = wibDayKey(iv.start);
    minutes.set(k, (minutes.get(k) ?? 0) + Math.round((iv.end.getTime() - iv.start.getTime()) / 60_000));
  }
  const max = Math.max(1, ...keys.map((k) => minutes.get(k) ?? 0));
  const last = intervals[intervals.length - 1];
  const lastMin = last ? Math.round((last.end.getTime() - last.start.getTime()) / 60_000) : 0;
  return (
    <Card tone="light" title="Aktivitas hujan" subtitle="Menit basah per hari, 7 hari terakhir">
      <svg viewBox="0 0 380 150" style={{ width: '100%', height: 'auto', marginTop: 12 }} role="img" aria-label="Menit basah per hari, 7 hari terakhir">
        <g stroke="var(--card2)"><path d="M0 30H380M0 70H380M0 110H380" /></g>
        {keys.map((k, i) => {
          const m = minutes.get(k) ?? 0;
          const h = (m / max) * 80;
          const cx = i * 54 + 27;
          const today = i === keys.length - 1;
          return (
            <g key={k}>
              <title>{`${k}: ${m} menit basah`}</title>
              <rect x={cx - 16} y={110 - Math.max(h, 2)} width="32" height={Math.max(h, 2)} rx="8" fill="#2c7fb0" opacity={m ? 1 : 0.25} />
              {m > 0 && <text x={cx} y={104 - h} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">{m}</text>}
              <text x={cx} y={134} textAnchor="middle" fontSize="12" fontWeight={today ? 800 : 600} fill={today ? 'var(--ink)' : 'var(--muted)'}>{DAYS[new Date(`${k}T12:00:00Z`).getUTCDay()]}</text>
            </g>
          );
        })}
      </svg>
      {last ? (
        <div className="li">
          <div><b>Hujan {DAYS[new Date(`${wibDayKey(last.start)}T12:00:00Z`).getUTCDay()]}, {formatWib(last.start, 'time')}–{formatWib(last.end, 'time')}</b><small>{lastMin} menit basah</small></div>
          <span className="chip">{now.getTime() - last.end.getTime() < 5 * 60_000 ? 'Berlangsung' : 'Selesai'}</span>
        </div>
      ) : (
        <div className="li"><div><b>Belum ada kejadian hujan</b><small>Dalam 7 hari terakhir</small></div></div>
      )}
    </Card>
  );
}
