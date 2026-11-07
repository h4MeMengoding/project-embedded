import { formatWib, wibDayKey } from '@ws/core';
import { Card } from './Card';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function RainActivityCard({ intervals, now }: { intervals: { start: Date; end: Date }[]; now: Date }) {
  const keys = Array.from({ length: 6 }, (_, i) => wibDayKey(new Date(now.getTime() - (5 - i) * 86400_000)));
  const minutes = new Map<string, number>();
  for (const iv of intervals) {
    const k = wibDayKey(iv.start);
    minutes.set(k, (minutes.get(k) ?? 0) + Math.round((iv.end.getTime() - iv.start.getTime()) / 60_000));
  }
  const max = Math.max(1, ...keys.map((k) => minutes.get(k) ?? 0));
  const last = intervals[intervals.length - 1];
  const lastMin = last ? Math.round((last.end.getTime() - last.start.getTime()) / 60_000) : 0;
  return (
    <Card tone="light" title="Aktivitas hujan" subtitle="Menit basah per hari">
      <div className="days">
        {keys.map((k, i) => (
          <span key={k} className={i === keys.length - 1 ? 'on' : ''}>{DAYS[new Date(`${k}T12:00:00Z`).getUTCDay()]}</span>
        ))}
      </div>
      <svg viewBox="0 0 380 120" style={{ width: '100%', height: 'auto' }} role="img" aria-label="Menit basah per hari">
        <g stroke="var(--card2)"><path d="M0 24H380M0 60H380M0 96H380" /></g>
        {keys.map((k, i) => {
          const h = ((minutes.get(k) ?? 0) / max) * 100;
          return <rect key={k} x={i * 63 + 12} y={110 - h} width="38" height={Math.max(h, 2)} rx="8" fill="#2c7fb0" opacity={minutes.get(k) ? 1 : 0.25} />;
        })}
      </svg>
      {last ? (
        <div className="li">
          <div><b>Hujan {formatWib(last.start, 'time')}–{formatWib(last.end, 'time')}</b><small>{lastMin} menit basah</small></div>
          <span className="chip">{now.getTime() - last.end.getTime() < 5 * 60_000 ? 'Berlangsung' : 'Selesai'}</span>
        </div>
      ) : (
        <div className="li"><div><b>Belum ada hujan tercatat</b><small>Pada rentang 6 hari</small></div></div>
      )}
    </Card>
  );
}
