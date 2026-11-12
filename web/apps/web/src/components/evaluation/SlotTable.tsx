'use client';
import { useState } from 'react';
import { formatWib, type SlotStatus } from '@ws/core';
import type { EvaluationSlotRow } from '@ws/db';

type Row = EvaluationSlotRow & { status: SlotStatus };

const yn = (v: boolean | null, y = 'Hujan', n = 'Tidak') => (v == null ? '—' : v ? y : n);
const STATUS_LABEL: Partial<Record<SlotStatus, string>> = { calibration: 'periode kalibrasi', upcoming: 'belum dimulai', running: 'sedang berjalan', incomplete: 'data tidak lengkap' };

function Verdict({ v }: { v: boolean | null }) {
  if (v == null) return <td style={{ padding: 8 }}>—</td>;
  return (
    <td style={{ padding: 8 }}>
      <span style={v ? { color: 'var(--ink)' } : { background: '#fde2e6', color: '#9f1d33', fontWeight: 700, padding: '3px 10px', borderRadius: 8 }}>{v ? 'Benar' : 'Salah'}</span>
    </td>
  );
}

export function SlotTable({ slots }: { slots: Row[] }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const shown = onlyWrong ? slots.filter((s) => s.fuzzyCorrect === false || s.bmkgCorrect === false) : slots;
  return (
    <section className="card light" style={{ overflowX: 'auto' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3>Hasil evaluasi per slot 3 jam</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#9f1d33' }} />
          Tampilkan hanya yang salah
        </label>
      </div>
      {slots.length === 0 ? (
        <p style={{ marginTop: 16 }}>Data slot belum tersedia. Jalankan perhitungan ulang evaluasi.</p>
      ) : shown.length === 0 ? (
        <p style={{ marginTop: 16 }}>Tidak ada slot dengan prediksi yang salah pada periode ini.</p>
      ) : (
        <table className="slot-table" style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', minWidth: 900, fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--muted)' }}>
              {['Slot', 'Peluang fuzzy', 'Prediksi fuzzy', 'Prakiraan BMKG', 'Prediksi BMKG', 'Menit basah', 'Hujan aktual', 'Ketepatan fuzzy', 'Ketepatan BMKG'].map((h) => <th key={h} style={{ padding: 8 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const label = STATUS_LABEL[s.status];
              return (
                <tr key={s.id} style={{ borderTop: '1px solid var(--card2)' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{formatWib(s.slotStart, 'datetime')}–{formatWib(s.slotEnd, 'time')}</td>
                  <td>{s.fuzzyProbability == null ? '—' : `${s.fuzzyProbability.toFixed(1).replace('.', ',')}%`}</td>
                  <td>{yn(s.fuzzyPredictRain)}</td>
                  <td>{s.bmkgWeatherDesc ?? '—'}</td>
                  <td>{yn(s.bmkgPredictRain)}</td>
                  <td>{s.wetMinutes ?? '—'}</td>
                  <td>{label ? <em>{label}</em> : yn(s.actualRain)}</td>
                  <Verdict v={label ? null : s.fuzzyCorrect} />
                  <Verdict v={label ? null : s.bmkgCorrect} />
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
