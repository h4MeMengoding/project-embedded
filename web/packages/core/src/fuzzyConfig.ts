export type Level3 = 'Rendah' | 'Sedang' | 'Tinggi';
export type Shape =
  | { kind: 'trap'; p: [number, number, number, number] }
  | { kind: 'tri'; p: [number, number, number] };

export type FuzzyConfig = {
  version: string;
  dp: Record<'Turun' | 'Stabil' | 'Naik', Shape>;
  rh: Record<'Rendah' | 'Sedang' | 'Tinggi', Shape>;
  dpd: Record<'Kecil' | 'Sedang' | 'Besar', Shape>;
  out: Record<Level3, Shape>;
  universe: { dp: [number, number]; rh: [number, number]; dpd: [number, number] };
  rules: { dp: string; rh: string; dpd: string; out: Level3 }[];
  /**
   * Koreksi variasi harian (pasang surut atmosfer semidiurnal): ΔP3h masukan fuzzy = ΔP3h teramati
   * dikurangi perubahan 3 jam yang diharapkan dari P(h) = A·cos(2π(h − puncak)/12), h = jam WIB.
   * Tidak ada pada v1 (tanpa koreksi).
   */
  pressureTide?: { amplitudeHpa: number; peakHourWib: number };
};

const T = 'Tinggi' as const;
const S = 'Sedang' as const;
const R = 'Rendah' as const;
const DP = ['Turun', 'Stabil', 'Naik'] as const;
const RH = ['Rendah', 'Sedang', 'Tinggi'] as const;
const DPD = ['Kecil', 'Sedang', 'Besar'] as const;

// CLAUDE.md 7.3, R1..R27 berurutan (dp, rh, dpd bersarang).
const OUT: Level3[] = [
  S, S, R, T, S, S, T, T, S, // Turun
  S, R, R, S, S, R, T, S, S, // Stabil
  R, R, R, S, R, R, S, S, R, // Naik
];

export const FUZZY_CONFIG_V1: FuzzyConfig = {
  version: 'v1',
  dp: {
    Turun: { kind: 'trap', p: [-10, -10, -1.5, -0.3] },
    Stabil: { kind: 'tri', p: [-1, 0, 1] },
    Naik: { kind: 'trap', p: [0.3, 1.5, 10, 10] },
  },
  rh: {
    Rendah: { kind: 'trap', p: [0, 0, 60, 75] },
    Sedang: { kind: 'tri', p: [65, 77.5, 90] },
    Tinggi: { kind: 'trap', p: [85, 93, 100, 100] },
  },
  dpd: {
    Kecil: { kind: 'trap', p: [0, 0, 1.5, 3] },
    Sedang: { kind: 'tri', p: [2, 4, 6] },
    Besar: { kind: 'trap', p: [5, 8, 30, 30] },
  },
  out: {
    Rendah: { kind: 'trap', p: [0, 0, 20, 40] },
    Sedang: { kind: 'tri', p: [30, 50, 70] },
    Tinggi: { kind: 'trap', p: [60, 80, 100, 100] },
  },
  universe: { dp: [-10, 10], rh: [0, 100], dpd: [0, 30] },
  rules: DP.flatMap((dp, i) =>
    RH.flatMap((rh, j) => DPD.map((dpd, k) => ({ dp, rh, dpd, out: OUT[i * 9 + j * 3 + k] }))),
  ),
};

/**
 * v2: fungsi keanggotaan dan 27 aturan sama dengan v1; yang berubah adalah masukan ΔP3h (dikoreksi variasi harian)
 * dan aturan keputusan biner (peluang dibulatkan 1 desimal, hujan bila > ambang). Amplitudo awal 1,0 hPa
 * (nilai tipikal wilayah tropis) dan hanya boleh disetel dari periode kalibrasi.
 */
export const FUZZY_CONFIG_V2: FuzzyConfig = {
  ...FUZZY_CONFIG_V1,
  version: 'v2',
  pressureTide: { amplitudeHpa: 1.0, peakHourWib: 10 },
};

/**
 * v3 (KANDIDAT, BELUM AKTIF): prinsip "peluang Tinggi hanya jika tekanan turun".
 * Beda dari v2 hanya R16 (Stabil, RH Tinggi, DPD Kecil): Tinggi -> Sedang. Tidak boleh diaktifkan
 * sebelum keputusan model utama dari laporan kalibrasi (CLAUDE.md 9.4a).
 */
export const FUZZY_CONFIG_V3: FuzzyConfig = {
  ...FUZZY_CONFIG_V2,
  version: 'v3',
  rules: FUZZY_CONFIG_V2.rules.map((r, i) => (i === 15 ? { ...r, out: S } : r)),
};

export const FUZZY_CONFIGS: Record<string, FuzzyConfig> = { v1: FUZZY_CONFIG_V1, v2: FUZZY_CONFIG_V2, v3: FUZZY_CONFIG_V3 };

export const ACTIVE_FUZZY_CONFIG: FuzzyConfig = FUZZY_CONFIG_V2;
