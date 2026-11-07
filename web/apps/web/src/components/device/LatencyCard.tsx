import { Card } from '../Card';

const s = (v: number | null) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')} dtk`);

export function LatencyCard({ l, backfill }: { l: { count: number; mean: number | null; median: number | null; p95: number | null }; backfill: { backfillRecords: number; longestOfflineMinutes: number } }) {
  return (
    <Card tone="light" title="Latensi dan backfill" subtitle={`${l.count} record non-backfill`}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 24px', marginTop: 16 }}>
        <dt>Rata-rata</dt><dd style={{ fontWeight: 700 }}>{s(l.mean)}</dd>
        <dt>Median</dt><dd style={{ fontWeight: 700 }}>{s(l.median)}</dd>
        <dt>p95</dt><dd style={{ fontWeight: 700 }}>{s(l.p95)}</dd>
        <dt>Record backfill</dt><dd style={{ fontWeight: 700 }}>{backfill.backfillRecords}</dd>
        <dt>Offline terlama</dt><dd style={{ fontWeight: 700 }}>{backfill.longestOfflineMinutes} menit</dd>
      </dl>
      <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>Latensi bergantung pada sinkronisasi NTP kedua sisi.</p>
    </Card>
  );
}
