import type { Metrics } from '@ws/core';
import type { EvaluationExcluded as Excluded } from '@ws/db';

const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`);

const REASONS: [keyof Excluded, string][] = [
  ['calibration', 'periode kalibrasi'],
  ['running', 'slot sedang berjalan'],
  ['upcoming', 'slot belum dimulai'],
  ['incomplete', 'data sensor tidak lengkap (< 80% menit)'],
  ['no_fuzzy', 'tanpa prediksi fuzzy'],
  ['no_bmkg', 'tanpa prakiraan BMKG'],
];

export function MetricsTable({ fuzzy, bmkg, excluded }: { fuzzy: Metrics; bmkg: Metrics; excluded: Excluded }) {
  const total = Object.values(excluded).reduce((a, b) => a + b, 0);
  const detail = REASONS.filter(([k]) => excluded[k] > 0).map(([k, l]) => `${excluded[k]} ${l}`).join('; ');
  const rows: [string, string, string][] = [
    ['Akurasi', pct(fuzzy.accuracy), pct(bmkg.accuracy)],
    ['Presisi', pct(fuzzy.precision), pct(bmkg.precision)],
    ['Recall', pct(fuzzy.recall), pct(bmkg.recall)],
    ['F1-score', pct(fuzzy.f1), pct(bmkg.f1)],
    ['Jumlah slot yang dievaluasi', String(fuzzy.n), String(bmkg.n)],
  ];
  return (
    <section className="card light" style={{ overflowX: 'auto' }}>
      <h3>Perbandingan metrik kinerja</h3>
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}><th style={{ padding: 8 }}>Metrik</th><th>Fuzzy Mamdani</th><th>BMKG (Sumber: BMKG)</th></tr></thead>
        <tbody>{rows.map(([a, b, c]) => <tr key={a} style={{ borderTop: '1px solid var(--card2)' }}><td style={{ padding: 8, fontWeight: 600 }}>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
      </table>
      <p style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
        Metrik fuzzy dan BMKG dihitung pada himpunan slot yang sama, yaitu slot yang telah selesai, memiliki data sensor lengkap, serta memiliki prediksi fuzzy dan prakiraan BMKG.
        {total > 0 ? ` Slot yang dikecualikan: ${total} (${detail}).` : ' Tidak ada slot yang dikecualikan.'}
      </p>
    </section>
  );
}
