import { formatWib } from '@ws/core';
import { Card } from '../Card';

export function GapList({ gaps }: { gaps: { start: Date; end: Date; minutes: number }[] }) {
  return (
    <Card tone="light" title="Periode offline" subtitle="Celah data lebih dari 5 menit">
      {gaps.length === 0 ? <p style={{ marginTop: 16 }}>Tidak ada celah data pada rentang ini.</p> : (
        <ul style={{ marginTop: 12 }}>
          {gaps.map((g) => (
            <li key={g.start.getTime()} className="li"><div><b>{formatWib(g.start, 'datetime')} → {formatWib(g.end, 'datetime')}</b><small>WIB</small></div><span className="chip">{g.minutes} menit</span></li>
          ))}
        </ul>
      )}
    </Card>
  );
}
