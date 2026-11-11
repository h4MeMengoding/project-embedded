'use client';
import { useMemo } from 'react';
import { dewPoint } from '@ws/core';
import type { LiveData } from '../lib/liveTypes';
import { useLive } from '../hooks/useLive';

const nf = (d: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const EMPTY: LiveData = { reading: null, prediction: null, device: { online: false, lastSeenAt: null } };

/** Beranda dev mode: semua pembacaan sensor live (tidak ada data tersimpan, prediksi, atau BMKG). */
export function DevHome() {
  const { reading: r, device } = useLive(EMPTY);
  const f = (v: number | null | undefined, d: number) => (v == null ? '—' : nf(d).format(v));
  const dp = useMemo(() => (r?.tempDht != null && r.humDht != null ? dewPoint(r.tempDht, r.humDht) : null), [r]);
  const wet = r?.rainWetSeconds == null ? '—' : r.rainWetSeconds >= 30 ? 'Hujan' : 'Tidak hujan';
  const items: [string, string, string][] = [
    ['Suhu DHT22', f(r?.tempDht, 1), '°C'],
    ['Kelembapan', f(r?.humDht, 0), '%'],
    ['Suhu BMP280', f(r?.tempBmp, 1), '°C'],
    ['Tekanan', f(r?.pressureHpa, 1), 'hPa'],
    ['Cahaya', f(r?.lux, 0), 'lux'],
    ['Titik embun', f(dp, 1), '°C'],
    ['Sensor hujan', wet, ''],
    ['Hujan (ADC)', f(r?.rainAnalog, 0), ''],
  ];
  return (
    <>
      <div className="banner" role="status" style={{ margin: '24px 0', padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,.14)', fontWeight: 700 }}>
        Dev mode: data tidak disimpan. Perangkat {device.online ? 'online' : 'offline'}.
      </div>
      <div className={`stats${device.online ? '' : ' stale'}`}>
        {items.map(([l, v, u]) => (
          <div className="stat" key={l}>
            <div className="l"><b />{l}</div>
            <div className="v">{v}{v !== '—' && u && <small>{u}</small>}</div>
          </div>
        ))}
      </div>
    </>
  );
}
