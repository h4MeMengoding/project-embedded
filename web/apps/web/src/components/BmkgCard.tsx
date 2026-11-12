import { formatWib, isRainForecast } from '@ws/core';
import type { BmkgRow } from '@ws/db';
import { Card } from './Card';

export function BmkgCard({ slots, mode }: { slots: BmkgRow[]; mode: 'start' | 'center' }) {
  return (
    <Card tone="yellow" title="Prakiraan BMKG" subtitle="Slot berjalan dan dua slot berikutnya">
      <div style={{ marginTop: 10 }}>
        {slots.length === 0 && <div className="slot"><div><b>Data prakiraan belum tersedia</b></div></div>}
        {slots.map((s) => {
          const start = mode === 'start' ? s.utcDatetime : new Date(s.utcDatetime.getTime() - 1.5 * 3600_000);
          const end = new Date(start.getTime() + 3 * 3600_000);
          const rain = isRainForecast({ weatherCode: s.weatherCode, weatherDesc: s.weatherDesc });
          return (
            <div className="slot" key={s.id}>
              <div>
                <div className="t">{formatWib(start, 'time')}–{formatWib(end, 'time')}</div>
                <b>{s.weatherDesc ?? '—'}</b>
              </div>
              <span className={`tg ${rain ? '' : 'no'}`}>{rain ? 'Hujan' : 'Tidak'}</span>
            </div>
          );
        })}
      </div>
      <div className="src">Sumber: BMKG</div>
    </Card>
  );
}
