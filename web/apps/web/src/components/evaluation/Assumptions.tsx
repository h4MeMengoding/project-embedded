import { BMKG_MAPPING_TABLE } from '@ws/core';

export function Assumptions({ minWet, threshold, slotMode }: { minWet: number; threshold: number; slotMode: 'start' | 'center' }) {
  return (
    <section className="card light">
      <h3>Definisi dan asumsi evaluasi</h3>
      <ul style={{ marginTop: 12, lineHeight: 1.8 }}>
        <li>Menit basah didefinisikan sebagai menit dengan durasi basah sensor hujan ≥ 30 detik. Slot dinyatakan hujan aktual apabila jumlah menit basah ≥ {minWet}.</li>
        <li>Slot dengan kelengkapan data menit kurang dari 80% (kurang dari 144 dari 180 menit) ditandai “data tidak lengkap” dan tidak diikutkan dalam perhitungan metrik.</li>
        <li>Prediksi fuzzy dinyatakan hujan apabila peluang ≥ {threshold}%.</li>
        <li>Mode slot BMKG: <b>{slotMode}</b>; prakiraan pada waktu T berlaku untuk interval {slotMode === 'start' ? '[T, T+3 jam)' : '[T−1,5 jam, T+1,5 jam)'}.</li>
        <li>Prakiraan BMKG yang dibandingkan adalah analysis_date terbaru yang terbit sebelum awal slot. Prediksi fuzzy yang dibandingkan adalah prediksi pada menit valid terakhir sebelum awal slot (paling lama 10 menit sebelumnya); menit awal slot tidak digunakan karena mencakup data setelah awal slot.</li>
      </ul>
      <h4 style={{ fontWeight: 700, marginTop: 16 }}>Pemetaan kode cuaca BMKG ke prediksi hujan</h4>
      <table style={{ marginTop: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}><th style={{ padding: 6 }}>Kode</th><th>Deskripsi</th><th>Hujan?</th></tr></thead>
        <tbody>{BMKG_MAPPING_TABLE.map((r) => <tr key={r.code} style={{ borderTop: '1px solid var(--card2)' }}><td style={{ padding: 6 }}>{r.code}</td><td>{r.desc}</td><td>{r.rain ? 'Ya' : 'Tidak'}</td></tr>)}</tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: 13 }}>Deskripsi cuaca yang mengandung kata “Hujan” juga diklasifikasikan sebagai prediksi hujan. Sumber: BMKG</p>
    </section>
  );
}
