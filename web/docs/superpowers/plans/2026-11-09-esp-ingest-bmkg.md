# ESP32 Firmware, HTTP Ingest, BMKG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ESP32 kirim data menit lewat HTTPS POST ke Next.js; server simpan, hitung fuzzy, ambil BMKG tiap jam, evaluasi tiap jam; wilayah BMKG disetel dari dashboard.

**Architecture:** Logika murni (parser BMKG, validasi payload) di `@ws/core`. Akses DB (ingest, prediksi, setting, simpan BMKG, token) di `@ws/db`. Route handler + cron (`instrumentation.ts`) + halaman `/pengaturan` di `apps/web`. Firmware PlatformIO di `esp/`.

**Tech Stack:** TypeScript, Next.js 15 App Router, Drizzle, vitest, `node:crypto` (scrypt, HMAC); Arduino-ESP32, ArduinoJson 7, LittleFS, WiFiClientSecure/HTTPClient.

**Spec:** `web/docs/superpowers/specs/2026-11-09-esp-ingest-bmkg-design.md`

## Global Constraints

- Tanpa dependensi npm baru. Firmware: hanya library di CLAUDE.md Bagian 4 (tanpa WebSockets, tanpa RTClib).
- Waktu disimpan UTC; `ts` di payload = Unix epoch detik UTC.
- Teks UI Bahasa Indonesia; setiap tampilan data BMKG menampilkan "Sumber: BMKG".
- Token tidak pernah disimpan teks biasa (format `scrypt$<saltHex>$<hashHex>`).
- Maks 60 record per request ingest; batch backfill firmware 50.
- Wilayah terkunci jika `EVAL_START` terisi dan `now >= EVAL_START`.
- Working tree berisi perubahan pengguna yang belum di-commit: **jangan commit**; pengguna yang memutuskan.

## Review Focus

1. Payload dengan `ts` tidak masuk akal (0, masa depan > 10 menit) → ditolak 400, bukan tersimpan.
2. Menit backfill datang terlambat → prediksi fuzzy untuk menit itu dan menit sesudahnya (≤ 3 jam+10 menit) dihitung; yang sudah ada tidak ditimpa.
3. Respons BMKG gagal/timeout/struktur tak terduga → cron log peringatan, proses tidak crash.
4. POST pengaturan tanpa cookie admin atau setelah `EVAL_START` → 401/403 di server, bukan hanya UI.
5. Firmware: file pending penuh → `buffer_full: true`, loop tetap jalan, watchdog tidak terpicu saat request lambat.

---

### Task 1: Parser BMKG (core)

**Files:** Create `packages/core/test/fixtures/bmkg-33.74.12.1001.json` (respons asli 2026-11-09); Modify `packages/core/src/bmkg.ts`; Test `packages/core/test/bmkg.test.ts`.

**Produces:**
```ts
export type BmkgLocation = { adm4: string; desa: string; kecamatan: string; kotkab: string; provinsi: string; lat: number; lon: number };
export type ParsedForecast = { analysisDate: Date; utcDatetime: Date; localDatetime: string; t: number|null; hu: number|null; weatherCode: number|null; weatherDesc: string|null; tcc: number|null; ws: number|null; wd: string|null; raw: unknown };
export function parseBmkg(json: unknown): { location: BmkgLocation; forecasts: ParsedForecast[]; unknown: string[] };
```
`unknown` = deskripsi `"<kode> <desc>"` yang tidak ada di `BMKG_MAPPING_TABLE`. `utc_datetime` `"YYYY-MM-DD HH:mm:ss"` dan `analysis_date` tanpa zona → UTC. Lempar `Error('Respons BMKG tidak dikenali')` jika `data[0].cuaca` bukan array.

- [ ] Test: fixture → `location.desa === 'Pakintelan'`, `forecasts.length === 17`, forecast pertama `utcDatetime.toISOString() === '2026-11-09T14:00:00.000Z'`, `analysisDate.toISOString() === '2026-11-09T12:00:00.000Z'`, `weatherCode === 2`; `parseBmkg({})` melempar.
- [ ] Implement, `npm test -w @ws/core` PASS.

### Task 2: Validasi payload ingest (core)

**Files:** Create `packages/core/src/ingest.ts`, export dari `index.ts`; Test `packages/core/test/ingest.test.ts`.

**Produces:**
```ts
export type SensorFlags = { dht22: boolean; bmp280: boolean; bh1750: boolean; rain: boolean };
export type IngestStatus = { ts: number|null; rssi: number; uptime_s: number; heap_free: number; backlog: number; buffer_full: boolean; time_valid: boolean; sensors: SensorFlags };
export type MinuteRecord = { type: 'minute'; ts: number; temp_dht: number|null; hum_dht: number|null; temp_bmp: number|null; pressure_hpa: number|null; lux: number|null; rain_analog_avg: number|null; rain_wet_seconds: number; samples: number; backfill: boolean };
export type RainEventRecord = { type: 'rain_event'; ts: number; state: 'start'|'stop'; backfill: boolean };
export type IngestPayload = { device_id: string; fw: string; status: IngestStatus; records: (MinuteRecord|RainEventRecord)[] };
export function parseIngestPayload(body: unknown, nowSec: number): { ok: true; value: IngestPayload } | { ok: false; error: string };
```
Aturan: `ts` record ≥ 1735689600 (2025-01-01) dan ≤ nowSec + 600; minute `ts % 60 === 0`; `rain_wet_seconds` 0–60; `samples` 0–6; angka nullable harus finite atau null; ≤ 60 record; `backfill` default false.

- [ ] Test: contoh payload spesifikasi Bagian 6 → ok; `ts: 0` → error; 61 record → error; `state: 'x'` → error; `temp_dht: "a"` → error; minute `ts` tidak kelipatan 60 → error.
- [ ] Implement, test PASS.

### Task 3: DB — migrasi, token, setting, prediksi, ingest, simpan BMKG

**Files:** Modify `packages/db/src/schema.ts` (`lastSensors: jsonb('last_sensors')` di `devices`); generate migrasi `packages/db/migrations/0002_*.sql`; Create `packages/db/src/token.ts`, `settings.ts`, `predictions.ts`, `ingest.ts`, `bmkgStore.ts`, `createDevice.ts`; export di `index.ts`; Modify `tools/seed/src/index.ts` (pakai `computePredictions`); Test `packages/db/test/token.test.ts`, `ingest.test.ts`.

**Produces:**
```ts
export function hashToken(token: string): string;              // scrypt N=16384, salt 16 byte
export function verifyToken(token: string, stored: string): boolean; // false untuk format lain
export async function getSetting(db: Db, key: string): Promise<string|null>;
export async function setSetting(db: Db, key: string, value: string): Promise<void>;
export async function getActiveAdm4(db: Db, envFallback: string): Promise<string>; // app_config 'bmkg_adm4' ?? envFallback
export async function computePredictions(db: Db, deviceId: string, minutes: Date[]): Promise<number>; // jumlah prediksi baru
export async function ingestPayload(db: Db, deviceId: string, p: IngestPayload, now: Date): Promise<{ stored: number; duplicates: number }>;
export async function storeBmkg(db: Db, adm4: string, f: ParsedForecast[]): Promise<number>;
```
`computePredictions`: untuk tiap menit target, baca `readings_minute` (target−191 menit, target], `computeWindowInputs` + `runFuzzy` (logika dipindah dari seed), insert `ON CONFLICT DO NOTHING`. `ingestPayload`: insert minute/rain_event (`is_backfill` dari record), update kolom `devices.last_*` + `last_sensors`, lalu `computePredictions` untuk menit yang baru tersimpan **plus** menit tersimpan dalam 190 menit setelahnya yang belum punya prediksi `ok` — prediksi `insufficient_data` yang lama dihapus dulu untuk menit-menit itu agar dihitung ulang. `createDevice.ts`: CLI `--id`, cetak token `randomBytes(32).toString('hex')` sekali, upsert `token_hash`. Script root: `"device:create": "npm run device:create -w @ws/db --"`.

- [ ] Test token: `verifyToken(t, hashToken(t))` true; token lain false; `'sha256$..'` false.
- [ ] Test ingest (skip tanpa DB, device id `test-ingest`): 200 menit sintetis tekanan+RH → prediksi `ok` di menit akhir; kirim ulang payload sama → `duplicates` = jumlah record; backfill menit lama → prediksi menit itu ada.
- [ ] `npm run db:generate -w @ws/db`, migrasi ke dev, test PASS, `npm run typecheck`.

### Task 4: Endpoint ingest + halaman Perangkat

**Files:** Create `apps/web/src/app/api/device/ingest/route.ts`; Modify `apps/web/src/components/device/SensorTable.tsx`, `apps/web/src/app/perangkat/page.tsx` (oper `sensors`).

**Consumes:** Task 2, Task 3.
Alur: rate limit per device 30/menit → JSON parse (400) → `parseIngestPayload` (400) → ambil `devices` by `device_id`, `verifyToken` dari header `Authorization: Bearer` (401) → `ingestPayload` → `{ ok, stored, duplicates, server_time }`.
SensorTable: kolom status "Terhubung"/"Belum terhubung" dari `devices.lastSensors` (null → "—").

- [ ] Verifikasi: `npm run device:create -- --id stasiun-01`, `npm run dev`, `curl` contoh payload → 200; ulang → `duplicates`; token salah → 401; body rusak → 400. `/perangkat` menampilkan "Belum terhubung" untuk DHT22/BH1750.

### Task 5: Job BMKG + evaluasi, wilayah aktif

**Files:** Create `apps/web/src/lib/bmkgJob.ts`, `apps/web/src/lib/jobs.ts`, `apps/web/src/instrumentation.ts`; Modify `page.tsx`, `evaluasi/page.tsx`, `api/evaluation/recompute/route.ts` (pakai `getActiveAdm4(db, env.adm4)`).

**Produces:**
```ts
export async function fetchBmkg(adm4: string): Promise<ReturnType<typeof parseBmkg>>; // timeout 15 s
export async function runBmkgJob(db: Db, adm4: string): Promise<number>; // log lokasi + unknown, 'SEED' → skip
export async function runEvaluationJob(db: Db): Promise<void>;
export function startJobs(): void; // tick 60 s; menit 5 BMKG, menit 10 evaluasi; BMKG sekali saat start; guard globalThis.__wsJobs
```
`instrumentation.ts`: `register()` → jika `process.env.NEXT_RUNTIME === 'nodejs'` dan `DATABASE_URL` ada dan `DISABLE_JOBS !== '1'`, import dinamis `startJobs`. Semua error job ditangkap dan di-log.

- [ ] Verifikasi: setel `app_config.bmkg_adm4 = '33.74.12.1001'`, `npm run dev` → log "BMKG: Pakintelan, Gunungpati, Kota Semarang — 17 prakiraan"; baris `bmkg_forecasts` bertambah.

### Task 6: Pengaturan wilayah + admin

**Files:** Create `apps/web/src/lib/adminAuth.ts`, `apps/web/src/app/api/admin/login/route.ts`, `apps/web/src/app/api/wilayah/[level]/[[...code]]/route.ts`, `apps/web/src/app/api/settings/region/route.ts`, `apps/web/src/app/pengaturan/page.tsx`, `apps/web/src/components/settings/RegionPicker.tsx`, `apps/web/src/components/settings/LoginForm.tsx`; Modify navigasi (`NavBar`/`NavKey`) tambah "Pengaturan"; Test `apps/web/test/adminAuth.test.ts`.

**Produces:**
```ts
export function sessionValue(password: string): string;           // HMAC-SHA256(password, 'ws-admin-v1') hex
export function isAdmin(cookieValue: string|undefined, password: string|undefined): boolean; // timingSafeEqual; false jika password kosong
export function isRegionLocked(evalStart: Date|null, now: Date): boolean;
```
- Login: POST `{password}`, rate limit 5/menit per IP, set cookie `ws_admin` httpOnly, sameSite lax, secure di produksi, 30 hari.
- `/api/wilayah/provinces`, `/api/wilayah/regencies/33`, `/districts/33.74`, `/villages/33.74.12` → proxy `https://wilayah.id/api/<level>/<code>.json`, `revalidate: 86400`; level di-whitelist, code regex `^[0-9.]{2,13}$`.
- `/api/settings/region`: GET `?adm4=` (admin) → `fetchBmkg` → `{ location }` untuk pratinjau; POST `{adm4}` (admin, tidak terkunci → 403) → validasi via `fetchBmkg`, `setSetting('bmkg_adm4')`, `setSetting('bmkg_location', "desa, kecamatan, kotkab")`, `runBmkgJob`.
- Halaman: tanpa `ADMIN_PASSWORD` → pesan "ADMIN_PASSWORD belum diisi"; belum login → form; login → wilayah aktif, 4 `<input list>`+`<datalist>` bertingkat, tombol "Cek ke BMKG", konfirmasi lokasi, "Simpan"; terkunci → hanya baca. "Sumber: BMKG".

- [ ] Test: `isAdmin(sessionValue('x'), 'x')` true; `isAdmin(sessionValue('x'), 'y')` false; `isAdmin(undefined, 'x')` false; `isAdmin(sessionValue(''), '')` false; `isRegionLocked(null, now)` false; `isRegionLocked(past, now)` true.
- [ ] Verifikasi di browser: login, pilih Jawa Tengah → Kota Semarang → Gunungpati → Pakintelan, cek, simpan; POST tanpa cookie → 401.

### Task 7: Firmware ESP32

**Files:** Modify `esp/platformio.ini`, `esp/.gitignore` (`include/config.h`); Create `esp/include/config.example.h`, `esp/include/config.h` (salinan lokal), `esp/src/main.cpp` (ganti sketsa uji), `esp/src/sensors.{h,cpp}`, `esp/src/aggregator.{h,cpp}`, `esp/src/uploader.{h,cpp}`, `esp/README.md` (wiring Bagian 3 + langkah).

Library: `adafruit/DHT sensor library`, `adafruit/Adafruit Unified Sensor`, `adafruit/Adafruit BMP280 Library`, `claws/BH1750`, `bblanchon/ArduinoJson@^7`. `board_build.filesystem = littlefs`.

- `sensors`: `struct Sample { float tDht, hDht, tBmp, pHpa, lux; int rainAo; bool wet; }` (NaN = tidak ada); `struct SensorFlags`; `void sensorsBegin(); void sensorsRetry(); Sample sensorsRead(); SensorFlags sensorsFlags();`.
- `aggregator`: tambah sampel; pada menit baru hasilkan JSON record minute; debounce 3 sampel → record rain_event.
- `uploader`: antrean RAM (30), `/pending.ndjson` (1 MB), `bool uploadOnce(statusJson)` sesuai spesifikasi 5.5; `esp_task_wdt_reset()` sebelum dan sesudah HTTP.
- `TEST_MODE`: cetak sampel + flag sensor tiap 2 detik, tanpa WiFi.

- [ ] `pio run -d esp` sukses (dan `TEST_MODE=1` via `-DTEST_MODE=1`).

### Task 8: Dokumen

Modify `CLAUDE.md` (Bagian 1, 2, 4.1, 4.3, 4.4, 5, 8, 10, 11.5, 14, 16 sesuai tabel spesifikasi Bagian 2), `web/.env.example` (`ADMIN_PASSWORD`, `DISABLE_JOBS`, catatan `BMKG_ADM4` cadangan), `web/README.md` (device:create, pengaturan).

- [ ] `npm test` dan `npm run typecheck` di `web/` PASS.
