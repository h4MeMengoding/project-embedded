import { parseBmkg } from '@ws/core';
import { storeBmkg, type Db } from '@ws/db';

const BMKG_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';
export const ADM4_RE = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;

/** Ambil dan parse prakiraan BMKG untuk satu kelurahan (kode Kemendagri, mis. 33.74.12.1001). */
export async function fetchBmkg(adm4: string): Promise<ReturnType<typeof parseBmkg>> {
  if (!ADM4_RE.test(adm4)) throw new Error(`Kode wilayah tidak valid: "${adm4}"`);
  const res = await fetch(`${BMKG_URL}?adm4=${adm4}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`BMKG HTTP ${res.status}`);
  return parseBmkg(await res.json());
}

/** Ambil BMKG untuk wilayah aktif dan simpan. Mengembalikan jumlah baris baru. */
export async function runBmkgJob(db: Db, adm4: string): Promise<number> {
  if (!ADM4_RE.test(adm4)) {
    console.warn(`[bmkg] wilayah belum disetel (adm4="${adm4}"); atur di /pengaturan`);
    return 0;
  }
  const r = await fetchBmkg(adm4);
  if (r.location.adm4 !== adm4) console.warn(`[bmkg] BMKG membalas adm4 ${r.location.adm4}, diminta ${adm4}`);
  for (const u of r.unknown) console.warn(`[bmkg] kode/deskripsi cuaca tidak dikenal: ${u}`);
  const n = await storeBmkg(db, adm4, r.forecasts);
  const l = r.location;
  console.log(`[bmkg] ${l.desa}, ${l.kecamatan}, ${l.kotkab} (${adm4}): ${r.forecasts.length} prakiraan, ${n} baru`);
  return n;
}
