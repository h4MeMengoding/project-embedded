import type { Metrics } from '@ws/core';

const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`);

export function MetricsTable({ fuzzy, bmkg }: { fuzzy: Metrics; bmkg: Metrics }) {
  const rows: [string, string, string][] = [
    ['Accuracy', pct(fuzzy.accuracy), pct(bmkg.accuracy)],
    ['Precision', pct(fuzzy.precision), pct(bmkg.precision)],
    ['Recall', pct(fuzzy.recall), pct(bmkg.recall)],
    ['F1-score', pct(fuzzy.f1), pct(bmkg.f1)],
    ['Jumlah slot dievaluasi', String(fuzzy.n), String(bmkg.n)],
  ];
  return (
    <section className="card light" style={{ overflowX: 'auto' }}>
      <h3>Perbandingan metrik</h3>
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}><th style={{ padding: 8 }}>Metrik</th><th>Fuzzy Mamdani</th><th>BMKG (Sumber: BMKG)</th></tr></thead>
        <tbody>{rows.map(([a, b, c]) => <tr key={a} style={{ borderTop: '1px solid var(--card2)' }}><td style={{ padding: 8, fontWeight: 600 }}>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
