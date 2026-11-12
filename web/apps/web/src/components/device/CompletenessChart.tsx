import { Card } from '../Card';

type C = { perDay: { dayWib: string; records: number; expected: number; pct: number }[]; total: { records: number; expected: number; pct: number } };

export function CompletenessChart({ c }: { c: C }) {
  return (
    <Card tone="light" title="Kelengkapan data" subtitle="Per hari, 1 record per menit">
      <p style={{ fontSize: 40, fontWeight: 700, marginTop: 12 }}>{c.total.pct.toFixed(1).replace('.', ',')}%<small style={{ fontSize: 15, fontWeight: 500, marginLeft: 8 }}>{c.total.records} dari {c.total.expected} menit</small></p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, marginTop: 12 }} role="img" aria-label="Kelengkapan data per hari">
        {c.perDay.map((d) => (
          <div key={d.dayWib} style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>
            <div style={{ height: `${Math.max(2, d.pct)}%`, minHeight: 2, background: '#2fae4f', borderRadius: 6 }} title={`${d.records}/${d.expected}`} />
            <div style={{ marginTop: 4 }}>{d.dayWib.slice(5)}</div>
            <div style={{ fontWeight: 700 }}>{d.pct.toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
