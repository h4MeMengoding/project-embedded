import { BMKG_MAPPING_TABLE } from '@ws/core';

export function Assumptions({ minWet, threshold, slotMode }: { minWet: number; threshold: number; slotMode: 'start' | 'center' }) {
  return (
    <section className="card light">
      <h3>Asumsi evaluasi</h3>
      <ul style={{ marginTop: 12, lineHeight: 1.8 }}>
        <li>Menit basah: menit dengan sensor hujan basah ≥ 30 detik. Slot dianggap hujan aktual bila menit basah ≥ {minWet}.</li>
        <li>Slot dengan data menit &lt; 80% (kurang dari 144 dari 180 menit) ditandai “data tidak lengkap” dan dikecualikan dari metrik.</li>
        <li>Ambang prediksi fuzzy: peluang ≥ {threshold}% dihitung memprediksi hujan.</li>
        <li>Mode slot BMKG: <b>{slotMode}</b> — {slotMode === 'start' ? 'prakiraan pada waktu T berlaku untuk [T, T+3 jam)' : 'prakiraan pada waktu T berlaku untuk [T−1,5 jam, T+1,5 jam)'}.</li>
        <li>Prakiraan BMKG yang dipakai: analysis_date terbaru yang terbit sebelum awal slot. Prediksi fuzzy: menit valid terakhir sebelum awal slot (maksimal 10 menit sebelumnya); menit awal slot sendiri tidak dipakai karena mencakup data sesudah awal slot.</li>
      </ul>
      <h4 style={{ fontWeight: 700, marginTop: 16 }}>Pemetaan cuaca BMKG → prediksi hujan</h4>
      <table style={{ marginTop: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}><th style={{ padding: 6 }}>Kode</th><th>Deskripsi</th><th>Hujan?</th></tr></thead>
        <tbody>{BMKG_MAPPING_TABLE.map((r) => <tr key={r.code} style={{ borderTop: '1px solid var(--card2)' }}><td style={{ padding: 6 }}>{r.code}</td><td>{r.desc}</td><td>{r.rain ? 'Ya' : 'Tidak'}</td></tr>)}</tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: 13 }}>Deskripsi yang mengandung kata “Hujan” juga dihitung hujan. Sumber: BMKG</p>
    </section>
  );
}
