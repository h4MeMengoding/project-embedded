import type { Confusion } from '@ws/core';

export function ConfusionMatrix({ title, cm }: { title: string; cm: Confusion }) {
  const cell = (label: string, v: number, good: boolean) => (
    <td style={{ padding: 16, textAlign: 'center', borderRadius: 12, background: good ? 'rgba(47,174,79,.18)' : 'rgba(209,85,59,.16)' }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800 }}>{v}</div>
    </td>
  );
  return (
    <section className="card light" data-aos="fade-up">
      <h3>Confusion matrix · {title}</h3>
      <div className="sub">Baris: kondisi aktual; kolom: hasil prediksi</div>
      <table style={{ width: '100%', marginTop: 16, borderSpacing: 8, borderCollapse: 'separate' }}>
        <thead>
          <tr><th /><th style={{ fontSize: 13 }}>Prediksi hujan</th><th style={{ fontSize: 13 }}>Prediksi tidak hujan</th></tr>
        </thead>
        <tbody>
          <tr><th style={{ fontSize: 13, textAlign: 'left' }}>Hujan aktual</th>{cell('TP', cm.tp, true)}{cell('FN', cm.fn, false)}</tr>
          <tr><th style={{ fontSize: 13, textAlign: 'left' }}>Tidak hujan aktual</th>{cell('FP', cm.fp, false)}{cell('TN', cm.tn, true)}</tr>
        </tbody>
      </table>
    </section>
  );
}
