import { formatWib } from '@ws/core';
import type { EvaluationSlotRow } from '@ws/db';

const yn = (v: boolean | null, y = 'Hujan', n = 'Tidak') => (v == null ? '—' : v ? y : n);
const ok = (v: boolean | null) => (v == null ? '—' : v ? '✓ Benar' : '✗ Salah');

export function SlotTable({ slots }: { slots: EvaluationSlotRow[] }) {
  return (
    <section className="card light" style={{ overflowX: 'auto' }}>
      <h3>Evaluasi per slot 3 jam</h3>
      {slots.length === 0 ? (
        <p style={{ marginTop: 16 }}>Belum ada slot. Tekan “Hitung ulang evaluasi”.</p>
      ) : (
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', minWidth: 900, fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}>
              {['Slot (WIB)', 'Peluang', 'Prediksi', 'Prakiraan BMKG', 'Prediksi BMKG', 'Menit basah', 'Hujan aktual', 'Fuzzy', 'BMKG'].map((h) => <th key={h} style={{ padding: 8 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--card2)' }}>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{formatWib(s.slotStart, 'datetime')}–{formatWib(s.slotEnd, 'time')}</td>
                <td>{s.fuzzyProbability == null ? '—' : `${s.fuzzyProbability.toFixed(0)}%`}</td>
                <td>{yn(s.fuzzyPredictRain)}</td>
                <td>{s.bmkgWeatherDesc ?? '—'}</td>
                <td>{yn(s.bmkgPredictRain)}</td>
                <td>{s.wetMinutes ?? '—'}</td>
                <td>{s.actualRain == null ? <em>data tidak lengkap</em> : yn(s.actualRain)}</td>
                <td>{ok(s.fuzzyCorrect)}</td>
                <td>{ok(s.bmkgCorrect)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
