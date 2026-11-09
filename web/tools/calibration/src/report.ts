import {
  ACTIVE_FUZZY_CONFIG, formatWib, type CalibSample, type Confusion, type FuzzyConfig, type HourStat, type RainOnset, type TideFit,
} from '@ws/core';

export type ReportData = {
  deviceId: string;
  from: Date;
  to: Date;
  expectedMinutes: number;
  readingMinutes: number;
  samples: CalibSample[];
  hours: HourStat[];
  confusion: Record<string, Confusion>;
  onsets: { onset: RainOnset; before: CalibSample | null }[];
  tide: TideFit | null;
  configs: FuzzyConfig[];
  threshold: number;
  minWetMinutes: number;
};

const n = (v: number | null | undefined, d = 2) => (v == null ? '—' : v.toFixed(d).replace('.', ','));
const p = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`);
const ver = (r: ReportData) => r.configs.map((c) => c.version);

export function renderCsv(r: ReportData): string {
  const v = ver(r);
  const head = ['jam_wib', 'n_menit', 'rh_mean', 'dpd_mean', 'dp3h_terkoreksi_mean', 'dp3h_mentah_mean', 'menit_tanpa_hujan', 'menit_hujan',
    ...v.flatMap((x) => [`peluang_mean_${x}`, `far_${x}`, `recall_${x}`])];
  const rows = r.hours.map((h) => [h.hour, h.n, h.rh, h.dpd, h.dp, h.dpRaw, h.noRain, h.rain, ...v.flatMap((x) => [h.meanProb[x], h.far[x], h.recall[x]])]
    .map((c) => (c == null ? '' : typeof c === 'number' ? String(Math.round(c * 1e4) / 1e4) : c)).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}

export function renderMarkdown(r: ReportData): string {
  const v = ver(r);
  const L: string[] = [];
  const cover = r.expectedMinutes ? (r.readingMinutes / r.expectedMinutes) * 100 : 0;
  L.push(`# Laporan Kalibrasi Fuzzy`, '');
  L.push(`- Perangkat: ${r.deviceId}`);
  L.push(`- Periode kalibrasi: ${formatWib(r.from, 'datetime')} – ${formatWib(r.to, 'datetime')} WIB`);
  L.push(`- Data: ${r.readingMinutes} dari ${r.expectedMinutes} menit (${n(cover, 1)}%); sampel fuzzy valid: ${r.samples.length}`);
  L.push(`- Config dibandingkan: ${v.join(', ')} (aktif di sistem: ${ACTIVE_FUZZY_CONFIG.version}); ambang prediksi: peluang (1 desimal) > ${r.threshold}%`);
  L.push(`- Definisi hujan: menit basah (≥ 30 dtk) ≥ ${r.minWetMinutes} dalam 3 jam setelah waktu prediksi; label hanya memakai data di dalam periode kalibrasi`);
  L.push(`- Laporan ini hanya untuk memutuskan model utama. Angka di sini bukan metrik makalah (tingkat menit, jendela label saling tumpang tindih).`, '');

  L.push('## 1. Profil per jam WIB', '');
  L.push(`Rata-rata masukan fuzzy dan laju alarm palsu (FAR = FP/(FP+TN) pada menit tanpa hujan 3 jam berikutnya). Recall = TP/(TP+FN) pada menit dengan hujan.`, '');
  L.push(['Jam', 'n', 'RH (%)', 'DPD (°C)', 'ΔP3h terkoreksi', 'ΔP3h mentah', 'Tanpa hujan', 'Hujan', ...v.flatMap((x) => [`Peluang ${x}`, `FAR ${x}`, `Recall ${x}`])].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  L.push('|' + Array(8 + v.length * 3).fill('---').join('|') + '|');
  for (const h of r.hours) {
    L.push(`| ${String(h.hour).padStart(2, '0')}.00 | ${h.n} | ${n(h.rh, 1)} | ${n(h.dpd)} | ${n(h.dp)} | ${n(h.dpRaw)} | ${h.noRain} | ${h.rain} | ${v.flatMap((x) => [n(h.meanProb[x], 1), p(h.far[x]), p(h.recall[x])]).join(' | ')} |`);
  }
  L.push('');

  L.push('## 2. Ringkasan seluruh periode (tingkat menit)', '');
  L.push('| Config | TP | FP | TN | FN | FAR | Recall |', '|---|---|---|---|---|---|---|');
  for (const x of v) {
    const c = r.confusion[x];
    L.push(`| ${x} | ${c.tp} | ${c.fp} | ${c.tn} | ${c.fn} | ${p(c.fp + c.tn ? c.fp / (c.fp + c.tn) : null)} | ${p(c.tp + c.fn ? c.tp / (c.tp + c.fn) : null)} |`);
  }
  const dawn = r.hours.filter((h) => h.hour >= 1 && h.hour < 7 && h.noRain > 0);
  if (dawn.length && v.length) {
    L.push('', `FAR dini hari (01.00–06.59 WIB): ${v.map((x) => `${x} ${p(dawn.reduce((a, h) => a + (h.far[x] ?? 0) * h.noRain, 0) / dawn.reduce((a, h) => a + h.noRain, 0))}`).join(', ')}.`);
  }
  L.push('');

  L.push('## 3. Estimasi variasi harian tekanan (harmonik 12 jam)', '');
  const cfg = r.configs[0]?.pressureTide;
  if (!r.tide) L.push('Data kurang dari 24 jam atau terlalu sedikit; estimasi belum bisa dihitung.');
  else {
    L.push(`- Amplitudo hasil regresi: ${n(r.tide.amplitudeHpa)} hPa (konfigurasi: ${cfg ? n(cfg.amplitudeHpa) : '—'} hPa)`);
    L.push(`- Puncak: ${n(r.tide.peakHourWib, 1)} dan ${n((r.tide.peakHourWib + 12) % 24, 1)} WIB (konfigurasi: ${cfg ? `${cfg.peakHourWib} dan ${cfg.peakHourWib + 12}` : '—'})`);
    L.push(`- Tren linear: ${n(r.tide.trendHpaPerDay)} hPa/hari; data: ${r.tide.n} menit selama ${n(r.tide.spanHours, 1)} jam`);
    L.push('- Catatan: dengan 1–2 hari data, perubahan sinoptik dapat terbaca sebagai variasi harian; amplitudo di atas adalah dasar penyetelan, bukan nilai pasti.');
  }
  L.push('');

  L.push('## 4. Masukan fuzzy 3 jam sebelum kejadian hujan', '');
  if (r.onsets.length === 0) L.push('Tidak ada kejadian hujan pada periode kalibrasi.');
  else {
    L.push(['Awal hujan (WIB)', 'Menit basah', 'Waktu prediksi', 'ΔP3h terkoreksi', 'ΔP3h mentah', 'RH (%)', 'DPD (°C)', ...v.flatMap((x) => [`Peluang ${x}`, `Prediksi ${x}`])].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    L.push('|' + Array(7 + v.length * 2).fill('---').join('|') + '|');
    for (const { onset, before } of r.onsets) {
      const head = `| ${formatWib(onset.start, 'datetime')} | ${onset.wetMinutes} |`;
      L.push(before
        ? `${head} ${formatWib(before.at, 'datetime')} | ${n(before.dp)} | ${n(before.dpRaw)} | ${n(before.rh, 1)} | ${n(before.dpd)} | ${v.flatMap((x) => [n(before.byVersion[x].prob, 1), before.byVersion[x].rain ? 'Hujan' : 'Tidak']).join(' | ')} |`
        : `${head} data tidak cukup 3 jam sebelum kejadian |${' |'.repeat(5 + v.length * 2)}`);
    }
  }
  L.push('', '## 5. Bahan keputusan', '');
  L.push('- Apakah alarm palsu dini hari (01.00–06.59 WIB) muncul pada data nyata, dan apakah v3 menurunkannya tanpa menurunkan recall secara berarti?');
  L.push('- Apakah amplitudo dan puncak hasil regresi mendekati konfigurasi (1,0 hPa, 10.00/22.00 WIB)? Bila tidak, tetapkan nilai baru sebelum pembekuan.');
  L.push('- Apakah kejadian hujan didahului ΔP3h terkoreksi negatif? Jumlah kejadian kecil membatasi kesimpulan.');
  L.push('- Setelah model utama dipilih: bekukan v2, v3, dan ambang > 50 (pembulatan 1 desimal) sebelum `EVAL_START`.', '');
  return L.join('\n');
}
