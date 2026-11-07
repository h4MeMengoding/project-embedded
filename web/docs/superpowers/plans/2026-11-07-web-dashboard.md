# Dashboard Web Stasiun Cuaca Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun dashboard Next.js (5 halaman + ekspor CSV) di atas `packages/core`, `packages/db`, dan data seed di Supabase dev, sehingga tidak ada kode yang berubah saat ingest dan hardware datang.

**Architecture:** Monorepo npm workspaces di dalam `web/`. `core` berisi logika murni (fuzzy, meteo, evaluasi, teks). `db` berisi skema Drizzle, migrasi, RLS, kueri bersama, dan job evaluasi. `apps/web` membaca database lewat `db` di server components dan route handlers. `tools/seed` mengisi data sintetis 7 hari yang berakhir pada "sekarang".

**Tech Stack:** TypeScript, Next.js (App Router), Tailwind CSS, Recharts, Drizzle ORM + drizzle-kit, `postgres` (postgres.js), vitest, Supabase Postgres.

**Spec:** `web/docs/superpowers/specs/2026-11-07-web-dashboard-design.md` (desain) dan `/CLAUDE.md` (spesifikasi induk: Bagian 6 skema, 7 fuzzy, 8 BMKG, 9 evaluasi, 11 halaman). Mockup: `web/docs/design/beranda-v6.html`.

## Global Constraints

- Semua kode di dalam `/Users/hame/Documents/weather-station/web/`. Folder `esp/` tidak disentuh.
- Fuzzy Mamdani saja, fungsi murni tanpa library fuzzy. Tanpa ML. Tanpa sensor di luar DHT22, BMP280, BH1750, FC-37.
- Database Supabase Postgres lewat Drizzle. RLS aktif di semua tabel, tanpa policy. Migrasi lewat direct connection atau session pooler (5432); runtime boleh pooler 6543 dengan `prepare: false`.
- Dua proyek Supabase: `dev` dan `prod`. Seed hanya jalan jika `app_config.environment = 'dev'`.
- Database UTC (`timestamptz`); semua tampilan dan CSV memakai Asia/Jakarta (WIB). CSV punya dua kolom waktu (UTC dan WIB).
- Setiap tempat yang menampilkan data BMKG menampilkan teks `Sumber: BMKG`.
- `BMKG_ADM4` tidak boleh ditebak. Baris BMKG sintetis: `adm4 = 'SEED'`, `raw = {"synthetic": true}`. Parser BMKG tidak ditulis.
- Parameter fuzzy `v1` dan 27 aturan persis CLAUDE.md Bagian 7.2 dan 7.3; mengubahnya wajib menaikkan `config_version`.
- Fuzzy: `predict_rain = probability >= PREDICT_THRESHOLD` (bawaan 50). Defuzzifikasi centroid, semesta 0–100, langkah 0,5. `insufficient_data` jika salah satu jendela 10 menit punya < 5 menit data valid.
- Evaluasi: menit basah = `rain_wet_seconds >= 30`; `actual_rain = true` jika menit basah >= `RAIN_MIN_WET_MINUTES` (bawaan 10); data menit < 144 dari 180 → `actual_rain = null`, dikecualikan dari metrik. Slot `start` = [T, T+3j), `center` = [T−1,5j, T+1,5j). Prediksi fuzzy: menit `slot_start` atau menit valid terdekat sebelumnya, maksimal 10 menit sebelum; tidak boleh memakai data setelah `slot_start`. BMKG: `analysis_date` terbaru yang terbit sebelum `slot_start`.
- BMKG `predict_rain = true` jika `weather_desc` mengandung "Hujan" (tidak peka huruf besar/kecil) atau kode cuaca ∈ {60, 61, 63, 80, 95, 97}.
- Tipografi: Plus Jakarta Sans saja (400–800); skala 13 / 15 / 20 / 40 / ±120 px; tanpa letter-spacing negatif; angka tabular-nums. Lebar konten `clamp(1120px, 80vw, 1440px)`, padding bingkai 64px, jarak kartu 28px, padding kartu 32px. Animasi mati pada `prefers-reduced-motion`.
- Teks tampilan (wajib persis): Tinggi → "Kemungkinan besar akan turun hujan"; kesepakatan → "BMKG juga memperkirakan hujan" / "BMKG memperkirakan tidak hujan"; sensor → "Saat ini masih kering" / "Saat ini sedang hujan"; fuzzy `insufficient_data` → "Menunggu 3 jam data tekanan". Kata "fuzzy" hanya di halaman Fuzzy dan keterangan teknis kecil.
- Env: `DATABASE_URL`, `DEVICE_ID`, `BMKG_ADM4` (opsional; kosong → `SEED`), `BMKG_SLOT_MODE`, `PREDICT_THRESHOLD`, `RAIN_MIN_WET_MINUTES`, `EVAL_START`, `EVAL_END`, `DEVICE_OFFLINE_AFTER_SEC`, `PUBLIC_WS_URL`.

## Review Focus

Input yang tidak disebut spesifikasi tetapi paling mungkin merusak pengalaman pengguna (tiap baris punya tes di task pemiliknya):

1. Database kosong atau perangkat belum pernah terlihat: semua halaman menampilkan keadaan kosong, bukan error (Task 7 dan 11).
2. Jendela fuzzy tepat 4 vs 5 menit data valid: 4 → `insufficient_data`, 5 → normal (Task 3).
3. Pengelompokan "per hari" memakai hari WIB, bukan UTC: record pukul 17:30 UTC masuk hari WIB berikutnya (Task 2 dan 7).
4. Slot tanpa prakiraan BMKG atau tanpa prediksi fuzzy: baris tampil dengan "—", dikeluarkan dari metrik prediktor yang kosong saja, bukan dari prediktor lain (Task 4 dan 9).
5. Nilai CSV berisi koma, tanda kutip, baris baru, atau diawali `=`, `+`, `-`, `@`: dikutip dan dinetralkan (Task 16).

---

## Task 1: Scaffold monorepo

**Files:**
- Create: `/Users/hame/Documents/weather-station/.gitignore`, `web/package.json`, `web/tsconfig.base.json`, `web/.env.example`
- Create: `web/apps/web/` (Next.js App Router, TypeScript, Tailwind), `web/packages/core/`, `web/packages/db/`, `web/tools/seed/` masing-masing dengan `package.json` dan `tsconfig.json`
- Create: `web/apps/web/src/app/globals.css`, `web/apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: nama paket `@ws/core`, `@ws/db`, `@ws/seed`, `@ws/web`; skrip root `npm test`, `npm run typecheck`, `npm run build`; token CSS `--ink --muted --page --card --yellow --accent --ok` dengan varian gelap (`[data-theme="dark"]` dan `prefers-color-scheme`).

- [ ] **Step 1:** Jalankan `git init` di `/Users/hame/Documents/weather-station`; `.gitignore` memuat `node_modules`, `.next`, `.env*` (kecuali `.env.example`), `.superpowers`, `dist`.
- [ ] **Step 2:** Buat workspaces `["apps/*","packages/*","tools/*"]`; `@ws/core` dan `@ws/db` diekspor sebagai TypeScript langsung (tanpa langkah build; Next memakai `transpilePackages`).
- [ ] **Step 3:** Buat `apps/web` dengan Tailwind; `layout.tsx` memuat Plus Jakarta Sans lewat `next/font/google` (weights 400–800) dan menaruh variabel font di `body`; `globals.css` mendefinisikan token warna dari mockup `beranda-v6.html` beserta varian gelap.
- [ ] **Step 4:** `.env.example` berisi semua variabel env pada Global Constraints dengan komentar singkat. Tiap workspace yang punya tes (`core`, `db`, `seed`, `apps/web`) memiliki skrip `test` yang menjalankan `vitest run`; skrip `test` di root menjalankan semuanya.
- [ ] **Step 5:** Verifikasi: `cd web && npm install && npm run typecheck && npm run build -w @ws/web`. Expected: ketiganya selesai tanpa error; halaman kosong `/` dibuka dengan `npm run dev -w @ws/web` dan memakai font Plus Jakarta Sans (periksa `document.fonts` di browser).
- [ ] **Step 6:** Commit `chore: scaffold web workspaces`.

## Task 2: core/meteo dan core/time

**Files:**
- Create: `web/packages/core/src/meteo.ts`, `web/packages/core/src/time.ts`, `web/packages/core/src/index.ts`
- Test: `web/packages/core/test/meteo.test.ts`, `web/packages/core/test/time.test.ts`

**Interfaces:**
- Produces: `dewPoint(tempC: number, rhPct: number): number` (Magnus a=17.62, b=243.12, RH di-clamp ke [1,100]); `dewPointDepression(tempC: number, rhPct: number): number`; `wibDayKey(d: Date): string` (`YYYY-MM-DD` di Asia/Jakarta); `formatWib(d: Date, style: 'datetime'|'time'|'date'): string` (24 jam, locale `id-ID`).

- [ ] **Step 1:** Tes: `dewPoint(30, 70)` `toBeCloseTo(23.9, 1)`; `dewPoint(25, 100)` ≈ 25; RH 0 dan RH 150 tidak melempar dan memberi angka terhingga (di-clamp); `dewPointDepression(30,70)` = 30 − `dewPoint(30,70)`.
- [ ] **Step 2:** Tes: `wibDayKey(new Date('2026-11-07T17:30:00Z'))` = `'2026-11-08'`; `wibDayKey(new Date('2026-11-07T16:59:00Z'))` = `'2026-11-07'`; `formatWib(new Date('2026-11-07T13:57:00Z'),'time')` = `'20.57'` (format dipilih agar cocok mockup; pisahkan dengan titik).
- [ ] **Step 3:** Jalankan `npx vitest run -w @ws/core` (atau `npm test -w @ws/core`). Expected: FAIL (fungsi belum ada).
- [ ] **Step 4:** Implementasikan keempat fungsi; `time.ts` memakai `Intl.DateTimeFormat` dengan `timeZone: 'Asia/Jakarta'`; ekspor semuanya dari `index.ts`.
- [ ] **Step 5:** Jalankan tes. Expected: PASS. Commit `feat(core): meteo and wib time helpers`.

## Task 3: core/fuzzy (konfigurasi, mesin, jendela input)

**Files:**
- Create: `web/packages/core/src/fuzzyConfig.ts`, `web/packages/core/src/fuzzy.ts`
- Test: `web/packages/core/test/fuzzy.test.ts`, `web/packages/core/test/fuzzyWindow.test.ts`

**Interfaces:**
- Consumes: `dewPoint`, `dewPointDepression` (Task 2).
- Produces (`fuzzyConfig.ts`): `type Level3 = 'Rendah'|'Sedang'|'Tinggi'`; `type FuzzyConfig = { version: string; dp: Record<'Turun'|'Stabil'|'Naik', Shape>; rh: Record<'Rendah'|'Sedang'|'Tinggi', Shape>; dpd: Record<'Kecil'|'Sedang'|'Besar', Shape>; out: Record<Level3, Shape>; universe: {dp:[number,number]; rh:[number,number]; dpd:[number,number]}; rules: {dp:string; rh:string; dpd:string; out:Level3}[] }` dengan `Shape = {kind:'trap'; p:[number,number,number,number]} | {kind:'tri'; p:[number,number,number]}`; `export const FUZZY_CONFIG_V1: FuzzyConfig` (27 aturan R1–R27 berurutan seperti CLAUDE.md 7.3).
- Produces (`fuzzy.ts`): `trap(a,b,c,d)(x): number`, `tri(a,b,c)(x): number`; `type FuzzyInput = {deltaP3h:number; rh:number; dpd:number}`; `type FuzzyResult = {configVersion:string; inputs:FuzzyInput; memberships:{dp:Record<string,number>; rh:Record<string,number>; dpd:Record<string,number>}; ruleStrengths:number[]; clipped:Record<Level3,number>; aggregated:{x:number[]; mu:number[]}; probability:number; category:Level3; noRuleFired:boolean}`; `runFuzzy(input: FuzzyInput, config?: FuzzyConfig): FuzzyResult`; `isPredictRain(probability:number, threshold?:number): boolean` (bawaan 50); `type MinuteRow = {ts:Date; tempDht:number|null; humDht:number|null; pressureHpa:number|null}`; `type WindowInputs = {status:'ok'; deltaP3h:number; rh:number; temp:number; dewPoint:number; dpd:number} | {status:'insufficient_data'}`; `computeWindowInputs(rows: MinuteRow[], at: Date): WindowInputs` (jendela sekarang = 10 menit yang berakhir pada `at`, jendela pembanding = 10 menit yang berakhir tepat 3 jam sebelumnya; rata-rata tekanan, RH, suhu dari baris valid saja).

- [ ] **Step 1:** Tes batas fungsi keanggotaan di titik a, b, c, d: `trap(0.3,1.5,10,10)` bernilai 0 di 0,3, 1 di 1,5, 0,5 di 0,9; `tri(-1,0,1)` bernilai 0 di −1, 1 di 0, 0 di 1, 0,5 di ±0,5; di luar semesta di-clamp (`trap(-10,-10,-1.5,-0.3)` bernilai 1 di −50).
- [ ] **Step 2:** Tes `runFuzzy` lima kasus hitung manual (toleransi `toBeCloseTo(x, 0)` untuk centroid): (dp 0, rh 77,5, dpd 4) → hanya R14 aktif (=1), probability 50, kategori Sedang; (dp 0, rh 100, dpd 0) → R16 =1, probability ≈ 84,44, Tinggi; (dp −2, rh 93, dpd 1) → R7 =1, ≈ 84,44, Tinggi; (dp 2, rh 40, dpd 10) → R21 =1, ≈ 15,56, Rendah; (dp −0,9, rh 87,5, dpd 3) → `ruleStrengths[4]` (R5) = 0,2, `[7]` (R8) = 0,3125, `[13]` (R14) = 0,1, `[16]` (R17) = 0,1, sisanya 0. Satu tes lagi dengan konfigurasi tanpa aturan (`rules: []`) → `probability` 0 dan `noRuleFired` true.
- [ ] **Step 3:** Tes `isPredictRain(50)` true, `isPredictRain(49.9)` false, `isPredictRain(60, 70)` false.
- [ ] **Step 4:** Tes `computeWindowInputs`: dengan 5 baris valid di tiap jendela → `ok` dan `deltaP3h` = selisih rata-rata yang benar; dengan 4 baris valid di jendela sekarang → `insufficient_data`; dengan 4 di jendela pembanding → `insufficient_data`; baris dengan `pressureHpa` null tidak dihitung; baris setelah `at` diabaikan.
- [ ] **Step 5:** Jalankan `npm test -w @ws/core`. Expected: FAIL.
- [ ] **Step 6:** Implementasikan sesuai antarmuka. AND = min, implikasi = min, agregasi = max, centroid pada 0..100 langkah 0,5; kategori = himpunan output dengan keanggotaan tertinggi pada nilai crisp. `aggregated` berisi 201 titik (untuk grafik di halaman Fuzzy).
- [ ] **Step 7:** Jalankan tes. Expected: PASS. Commit `feat(core): fuzzy mamdani engine, config v1, window inputs`.

## Task 4: core/evaluation

**Files:**
- Create: `web/packages/core/src/evaluation.ts`
- Test: `web/packages/core/test/evaluation.test.ts`

**Interfaces:**
- Produces: `type Slot = {start:Date; end:Date}`; `slotBounds(forecastUtc: Date, mode:'start'|'center'): Slot`; `labelActualRain(minutes:{ts:Date; rainWetSeconds:number|null}[], slot:Slot, minWetMinutes?:number): {wetMinutes:number; dataMinutes:number; actualRain:boolean|null}`; `pickFuzzyPrediction<T extends {ts:Date; status:string}>(preds:T[], slotStart:Date): T|null`; `pickBmkgForecast<T extends {analysisDate:Date; utcDatetime:Date}>(forecasts:T[], forecastUtc:Date, slotStart:Date): T|null`; `type Confusion = {tp:number; fp:number; tn:number; fn:number}`; `confusion(rows:{actual:boolean|null; predicted:boolean|null}[]): Confusion` (baris dengan salah satu null dilewati); `type Metrics = {n:number; accuracy:number|null; precision:number|null; recall:number|null; f1:number|null}`; `metricsOf(cm: Confusion): Metrics` (pembagian nol → `null`).

- [ ] **Step 1:** Tes `slotBounds`: mode `start` untuk `2026-11-07T14:00Z` → [14:00Z, 17:00Z); mode `center` → [12:30Z, 15:30Z).
- [ ] **Step 2:** Tes `labelActualRain`: 143 menit data → `actualRain` null; 144 menit → bukan null; 9 menit basah (`rainWetSeconds >= 30`) → false; 10 menit basah → true; `rainWetSeconds` 29 tidak dihitung basah; menit di luar slot diabaikan; `rainWetSeconds` null dihitung sebagai data tapi bukan basah.
- [ ] **Step 3:** Tes `pickFuzzyPrediction`: prediksi tepat di `slotStart` dipilih; jika tidak ada, prediksi valid terdekat sebelum `slotStart` dalam 10 menit; prediksi 11 menit sebelum → null; prediksi setelah `slotStart` tidak pernah dipilih; prediksi `insufficient_data` dilewati.
- [ ] **Step 4:** Tes `pickBmkgForecast`: dari dua `analysisDate` yang terbit sebelum `slotStart` dan satu sesudahnya, dipilih yang terbaru sebelum `slotStart`; hanya forecast dengan `utcDatetime` sama dengan `forecastUtc` yang dipertimbangkan; tidak ada → null.
- [ ] **Step 5:** Tes `confusion` dan `metricsOf`: kasus TP=3, FP=1, TN=4, FN=2 → accuracy 0,7, precision 0,75, recall 0,6, f1 ≈ 0,667; semua prediksi negatif dan semua aktual negatif → precision, recall, f1 `null`, accuracy 1; baris dengan `actual` null atau `predicted` null dikeluarkan (n tidak bertambah).
- [ ] **Step 6:** Jalankan tes → FAIL; implementasikan; jalankan → PASS. Commit `feat(core): evaluation slots, labels, metrics`.

## Task 5: core/bmkg dan core/copy

**Files:**
- Create: `web/packages/core/src/bmkg.ts`, `web/packages/core/src/copy.ts`
- Test: `web/packages/core/test/bmkg.test.ts`, `web/packages/core/test/copy.test.ts`

**Interfaces:**
- Produces: `BMKG_RAIN_CODES: readonly number[]` = [60,61,63,80,95,97]; `isRainForecast(f:{weatherCode?:number|null; weatherDesc?:string|null}): boolean`; `BMKG_MAPPING_TABLE: {code:number; desc:string; rain:boolean}[]` (untuk tabel di halaman Evaluasi: enam kode hujan plus kode tak-hujan umum 0, 1, 2, 3, 4, 5, 10, 45); `categoryCopy(c: Level3): string` (Rendah → "Kemungkinan kecil hujan", Sedang → "Mungkin hujan", Tinggi → "Kemungkinan besar akan turun hujan"); `agreementCopy(fuzzyRain:boolean, bmkgRain:boolean|null): string` (bmkg null → "Prakiraan BMKG belum tersedia"); `currentRainCopy(wet:boolean|null): string` (null → "Status sensor hujan belum diketahui").

- [ ] **Step 1:** Tes `isRainForecast`: desc "Hujan Ringan" true; "hujan petir" true (tidak peka huruf besar/kecil); "Berawan" false; kode 63 dengan desc null true; kode 3 false; desc "Cerah" dengan kode 95 true (kode menang).
- [ ] **Step 2:** Tes copy: `categoryCopy('Tinggi')` = "Kemungkinan besar akan turun hujan"; `agreementCopy(true,true)` = "BMKG juga memperkirakan hujan"; `agreementCopy(true,false)` = "BMKG memperkirakan tidak hujan"; `agreementCopy(false,false)` = "BMKG juga memperkirakan tidak hujan"; `agreementCopy(false,true)` = "BMKG memperkirakan hujan"; `currentRainCopy(false)` = "Saat ini masih kering"; `currentRainCopy(true)` = "Saat ini sedang hujan".
- [ ] **Step 3:** Jalankan → FAIL; implementasikan; jalankan → PASS. Commit `feat(core): bmkg rain mapping and ui copy`.

## Task 6: db/skema, migrasi, RLS, klien

**Files:**
- Create: `web/packages/db/src/schema.ts`, `web/packages/db/src/client.ts`, `web/packages/db/src/index.ts`, `web/packages/db/drizzle.config.ts`, `web/packages/db/migrations/` (hasil `drizzle-kit generate` + satu file SQL RLS)
- Test: `web/packages/db/test/schema.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` (direct/session pooler untuk migrasi).
- Produces: tabel Drizzle `devices`, `readingsMinute`, `rainEvents`, `fuzzyPredictions`, `bmkgForecasts`, `evaluationSlots`, `appConfig` dengan kolom persis CLAUDE.md Bagian 6 (nama kolom snake_case di database, camelCase di TypeScript); `createDb(url:string, opts?:{max?:number}): Db` (postgres.js dengan `prepare:false`); `type Db`; skrip `npm run db:generate` dan `db:migrate` di `@ws/db`.

- [ ] **Step 1 (titik henti, butuh pengguna):** Minta pengguna membuat proyek Supabase **dev** dan memberikan connection string session pooler (5432) untuk ditaruh di `web/.env.local` sebagai `DATABASE_URL`. Jangan mengarang kredensial. Lanjut hanya setelah file itu ada.
- [ ] **Step 2:** Tulis tes `schema.test.ts` (dilewati dengan pesan jelas bila `DATABASE_URL` tidak ada, dan gagal bila `app_config.environment` ≠ `dev`): setelah migrasi, `information_schema.tables` memuat ketujuh tabel; `pg_class.relrowsecurity` true untuk semuanya; sisipan dua baris `readings_minute` dengan `(device_id, ts)` sama memunculkan konflik unik (gunakan `ON CONFLICT DO NOTHING` dan pastikan hanya satu baris tersimpan); semua kolom waktu bertipe `timestamp with time zone`.
- [ ] **Step 3:** Jalankan tes → FAIL (tabel belum ada).
- [ ] **Step 4:** Tulis `schema.ts` (UNIQUE dan indeks sesuai Bagian 6: `readings_minute(device_id, ts)` unik dan indeks `ts`; `rain_events(device_id, ts, state)` unik; `fuzzy_predictions(device_id, ts)` unik; `bmkg_forecasts(adm4, analysis_date, utc_datetime)` unik; `evaluation_slots(device_id, slot_start)` unik). Jalankan `db:generate`; tambahkan migrasi SQL kustom yang menjalankan `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` untuk ketujuh tabel; jalankan `db:migrate`; sisipkan `app_config('environment','dev')`.
- [ ] **Step 5:** Jalankan tes → PASS. Commit `feat(db): schema, migrations, rls`.

## Task 7: db/kueri bersama

**Files:**
- Create: `web/packages/db/src/queries.ts`
- Test: `web/packages/db/test/queries.test.ts`

**Interfaces:**
- Consumes: skema (Task 6); `wibDayKey` (Task 2).
- Produces (semuanya `(db: Db, ...) => Promise<...>`, waktu sebagai `Date`):
  `getLatestReading(deviceId): ReadingRow|null`; `getLatestPrediction(deviceId): PredictionRow|null`; `getDeviceStatus(deviceId, offlineAfterSec:number, now:Date): {online:boolean; lastSeenAt:Date|null; rssi:number|null; uptimeS:number|null; heapFree:number|null; backlog:number|null; fwVersion:string|null; bufferFull:boolean|null}`; `getSeries(deviceId, from, to): {readings:ReadingRow[]; predictions:PredictionRow[]}`; `getRainIntervals(deviceId, from, to): {start:Date; end:Date}[]` (dari menit berurutan dengan `rain_wet_seconds >= 30`); `getBmkgSlots(adm4:string, fromUtc:Date, count:number): BmkgRow[]` (hanya `analysis_date` terbaru per `utc_datetime`); `getCompleteness(deviceId, from, to): {perDay:{dayWib:string; records:number; expected:number; pct:number}[]; total:{records:number; expected:number; pct:number}}`; `getLatencyStats(deviceId, from, to): {count:number; mean:number|null; median:number|null; p95:number|null}` (`received_at − (ts + 60 detik)`, hanya `is_backfill = false`); `getOfflineGaps(deviceId, from, to, minGapMinutes?:number): {start:Date; end:Date; minutes:number}[]` (bawaan 5); `getBackfillStats(deviceId, from, to): {backfillRecords:number; longestOfflineMinutes:number}`.

- [ ] **Step 1:** Tes (device id unik `test-<acak>`, dibersihkan di `afterAll`, dilewati tanpa `DATABASE_URL`): perangkat tak dikenal → `getLatestReading` null, `getSeries` kosong, `getCompleteness.total.pct` 0 tanpa `NaN`, `getOfflineGaps` kosong.
- [ ] **Step 2:** Tes `getCompleteness`: 3 record pada `2026-11-07T17:30Z`, `17:31Z`, `2026-11-07T16:59Z` terhitung ke `dayWib` `'2026-11-08'` (dua record) dan `'2026-11-07'` (satu); `expected` per hari penuh = 1440.
- [ ] **Step 3:** Tes `getOfflineGaps`: record pada menit 0, 1, 2 lalu menit 9 → satu celah (2→9, `minutes` = 7); record pada menit 0 lalu menit 5 → tidak ada celah (selisih tepat 5 menit tidak dilaporkan); selisih 6 menit → dilaporkan; `getLatencyStats` mengabaikan record `is_backfill = true`; `getDeviceStatus` offline jika `last_seen_at` lebih lama dari `offlineAfterSec`, dan `online=false` dengan `lastSeenAt=null` untuk perangkat yang belum pernah terlihat.
- [ ] **Step 4:** Tes `getBmkgSlots`: dua `analysis_date` untuk `utc_datetime` yang sama hanya mengembalikan yang terbaru; hasil terurut naik menurut `utc_datetime` dan dibatasi `count`.
- [ ] **Step 5:** Jalankan tes → FAIL; implementasikan dengan SQL agregat (`percentile_cont` untuk median dan p95); jalankan → PASS. Commit `feat(db): shared queries`.

## Task 8: tools/seed

**Files:**
- Create: `web/tools/seed/src/generate.ts`, `web/tools/seed/src/guard.ts`, `web/tools/seed/src/index.ts`
- Test: `web/tools/seed/test/generate.test.ts`, `web/tools/seed/test/guard.test.ts`

**Interfaces:**
- Consumes: `runFuzzy`, `computeWindowInputs`, `isPredictRain` (core); `createDb`, skema (db).
- Produces: `type Scenario = 'normal'|'offline'|'insufficient'|'disagree'`; `generateSeries(opts:{end:Date; days:number; seed:number; scenario:Scenario}): {minutes:MinuteSeed[]; rainEvents:RainEventSeed[]; backfillRanges:{start:Date; end:Date}[]}` (deterministik untuk `seed` sama; suhu harian, tekanan siklus ±1,5 hPa, hujan acak, beberapa celah offline yang kemudian terisi `is_backfill`); `generateBmkg(opts:{from:Date; days:number; scenario:Scenario}): BmkgSeed[]` (per 3 jam, `adm4='SEED'`, `raw={"synthetic":true}`); `assertDevEnvironment(db: Db): Promise<void>` (melempar bila `app_config.environment` ≠ `dev` atau tidak ada); CLI `npm run seed -w @ws/seed -- [--scenario normal|offline|insufficient|disagree] [--days 7]`.

- [ ] **Step 1:** Tes `generate.test.ts`: dua panggilan dengan `seed` sama menghasilkan hasil identik; `end` = waktu uji dan baris menit terakhir ≤ `end`; semua `rainWetSeconds` ∈ 0..60; skenario `insufficient` hanya menghasilkan data < 3 jam; skenario `offline` membuat menit terakhir minimal 10 menit sebelum `end`; `generateBmkg` selalu `adm4 === 'SEED'` dan `raw.synthetic === true` dan mencakup `end` sampai 3 hari ke depan.
- [ ] **Step 2:** Tes `guard.test.ts`: dengan DB tiruan yang mengembalikan `environment = 'prod'` → `assertDevEnvironment` melempar; `'dev'` → lolos; baris tidak ada → melempar.
- [ ] **Step 3:** Jalankan tes → FAIL.
- [ ] **Step 4:** Implementasikan generator murni dan guard. `index.ts`: panggil `assertDevEnvironment` **sebelum** menulis apa pun; upsert `devices`(`DEVICE_ID`, `token_hash` placeholder hash dari string acak), `readings_minute`, `rain_events`, `fuzzy_predictions` (dihitung dengan `runFuzzy` per menit), `bmkg_forecasts`; semua dengan `ON CONFLICT DO NOTHING` (idempoten); perbarui `devices.last_seen_at`, `last_rssi`, dan seterusnya agar perangkat tampil online (kecuali skenario `offline`); panggil `recomputeEvaluation` (Task 9) di akhir bila sudah ada.
- [ ] **Step 5:** Jalankan tes → PASS. Jalankan `npm run seed -w @ws/seed` dua kali berturut-turut ke database dev; periksa jumlah baris `readings_minute` tidak berlipat pada putaran kedua. Commit `feat(seed): synthetic 7-day dataset with dev guard`.

## Task 9: db/job evaluasi

**Files:**
- Create: `web/packages/db/src/evaluationJob.ts`
- Modify: `web/tools/seed/src/index.ts` (panggil job di akhir)
- Test: `web/packages/db/test/evaluationJob.test.ts`

**Interfaces:**
- Consumes: fungsi evaluasi dan `isRainForecast` (core), skema, `getBmkgSlots`-style kueri.
- Produces: `recomputeEvaluation(db: Db, opts:{deviceId:string; adm4:string; from:Date; to:Date; slotMode:'start'|'center'; minWetMinutes:number; predictThreshold:number}): Promise<{slots:number}>` (menimpa `evaluation_slots` untuk rentang itu); `getEvaluation(db: Db, deviceId:string, from:Date, to:Date): Promise<{slots:EvaluationSlotRow[]; fuzzy:{cm:Confusion; metrics:Metrics}; bmkg:{cm:Confusion; metrics:Metrics}}>`.

- [ ] **Step 1:** Tes (data fixture disisipkan oleh tes, id perangkat unik): satu slot dengan 180 menit data, 12 menit basah, prediksi fuzzy 70 di `slot_start`, BMKG "Hujan Ringan" → `actual_rain` true, `fuzzy_correct` true, `bmkg_correct` true; slot dengan 100 menit data → `actual_rain` null, `fuzzy_correct` null, dikeluarkan dari `cm`; slot dengan fuzzy tetapi tanpa BMKG → `bmkg_predict_rain` null dan baris tetap ada, tercakup di `cm` fuzzy tetapi bukan `cm` BMKG; menjalankan `recomputeEvaluation` dua kali tidak menggandakan baris.
- [ ] **Step 2:** Jalankan → FAIL; implementasikan (slot berasal dari `utc_datetime` BMKG di rentang, bukan dari grid tetap); jalankan → PASS. Commit `feat(db): evaluation job`.

## Task 10: Kerangka web, tema, komponen dasar

**Files:**
- Create: `web/apps/web/src/lib/env.ts`, `web/apps/web/src/lib/db.ts`
- Create: `web/apps/web/src/components/{NavBar,ThemeToggle,Card,Pill,RingGauge,StationIllustration,PageShell}.tsx`
- Modify: `web/apps/web/src/app/layout.tsx`, `globals.css`
- Test: `web/apps/web/test/env.test.ts`, `web/apps/web/test/ringGauge.test.ts`

**Interfaces:**
- Produces: `getEnv(): {deviceId:string; adm4:string; slotMode:'start'|'center'; predictThreshold:number; rainMinWetMinutes:number; evalStart:Date|null; evalEnd:Date|null; offlineAfterSec:number; publicWsUrl:string|null}` (`BMKG_ADM4` kosong → `'SEED'`; bawaan: threshold 50, minWet 10, offline 180, slotMode `start`); `getDb(): Db` (singleton, `max` kecil); `ringGeometry(percent:number): {dash:string; track:string}` (murni, untuk cincin 270°: panjang busur 405 dari keliling 540, sesuai mockup); komponen `RingGauge({percent:number|null; label?:string})` (null → cincin kosong, tanpa angka), `Pill({tone:'white'|'glass'|'ok'|'warn', children})`, `Card({tone:'light'|'dark'|'yellow', title, subtitle?, children})`, `StationIllustration()` (SVG dan animasi persis mockup; label sensor hanya DHT22, BMP280, BH1750, FC-37), `NavBar({active, online:boolean})`, `ThemeToggle()` (menyimpan pilihan di `localStorage` dalam try/catch; tanpa pilihan mengikuti sistem), `PageShell` (lebar dan padding sesuai Global Constraints).

- [ ] **Step 1:** Tes `getEnv`: tanpa `BMKG_ADM4` → `'SEED'`; `PREDICT_THRESHOLD='60'` → 60; `BMKG_SLOT_MODE='abc'` → melempar galat yang menyebut nama variabel; `EVAL_START` tidak valid → melempar.
- [ ] **Step 2:** Tes `ringGeometry(72)`: `dash` = `"292 540"` (±1 untuk pembulatan); `ringGeometry(0)` dan `ringGeometry(100)` tidak menghasilkan nilai negatif atau `NaN`; nilai di luar 0–100 di-clamp.
- [ ] **Step 3:** Jalankan → FAIL; implementasikan; jalankan → PASS.
- [ ] **Step 4:** Bangun komponen dan `PageShell` mengikuti mockup `beranda-v6.html` (hero hijau dengan kartu menimpa tepi diatur di halaman, bukan di `PageShell`). Mode gelap: varian token, bukan inversi otomatis.
- [ ] **Step 5:** Verifikasi di browser: halaman uji sementara memuat tiap komponen; periksa terang, gelap, lebar 1440, dan 390 (HP: nav menjadi menu ringkas, kartu bertumpuk). Hapus halaman uji. Commit `feat(web): shell, theme, base components`.

## Task 11: Beranda `/` dan data real-time

**Files:**
- Create: `web/apps/web/src/app/page.tsx`, `web/apps/web/src/app/api/live/route.ts`, `web/apps/web/src/hooks/useLive.ts`
- Create: `web/apps/web/src/components/{SensorStrip,BmkgCard,ProbabilityHistoryCard,RainActivityCard,HeroPrediction}.tsx`
- Test: `web/apps/web/test/homeState.test.ts`

**Interfaces:**
- Consumes: kueri Task 7; `categoryCopy`, `agreementCopy`, `currentRainCopy`, `dewPoint`, `isRainForecast`, `formatWib` (core); komponen Task 10.
- Produces: `deriveHomeState(input:{reading:ReadingRow|null; prediction:PredictionRow|null; bmkgNow:BmkgRow|null; device:DeviceStatus; threshold:number}): HomeState` murni dengan `HomeState = {kind:'empty'} | {kind:'ok'|'insufficient'|'offline'; percent:number|null; headline:string; agreement:string|null; current:string; sensors:{temp:number|null; hum:number|null; pressure:number|null; lux:number|null; dewPoint:number|null}; lastSeenLabel:string|null}`; `GET /api/live` mengembalikan `{reading, prediction, device}` terbaru dengan `Cache-Control: no-store`; `useLive(initial): LiveData` (WebSocket ke `publicWsUrl` bila ada, jatuh ke polling `/api/live` tiap 10 detik, tanpa melempar bila keduanya gagal).

- [ ] **Step 1:** Tes `deriveHomeState`: tanpa data apa pun → `kind:'empty'`; prediksi `insufficient_data` → `kind:'insufficient'`, `percent` null, headline "Menunggu 3 jam data tekanan"; perangkat offline → `kind:'offline'` dan nilai terakhir tetap ada dengan `lastSeenLabel` terisi; fuzzy hujan dan BMKG tidak hujan → `agreement` "BMKG memperkirakan tidak hujan"; BMKG null → "Prakiraan BMKG belum tersedia"; `rain_wet_seconds` terakhir ≥ 30 → current "Saat ini sedang hujan".
- [ ] **Step 2:** Jalankan → FAIL; implementasikan `deriveHomeState`; jalankan → PASS.
- [ ] **Step 3:** Bangun `page.tsx` (server component; ambil data lewat kueri Task 7) sesuai mockup `beranda-v6.html`: hero (cincin, rentang jam prediksi = `prediction.ts` sampai `prediction.ts` + 3 jam dalam WIB, kalimat, dua pil, stasiun), baris lima sensor, tiga kartu. Kartu BMKG menampilkan slot saat ini dan dua berikutnya serta `Sumber: BMKG`. Keadaan `empty` menampilkan kartu kosong dengan teks "Belum ada data. Jalankan seed atau hubungkan perangkat." tanpa error.
- [ ] **Step 4:** Verifikasi di browser terhadap data seed untuk keempat skenario (`normal`, `offline`, `insufficient`, `disagree`, masing-masing dengan `npm run seed -- --scenario ...`), terang dan gelap, lebar 1440 dan 390; bandingkan dengan `beranda-v6.html`. Periksa tidak ada teks "fuzzy" di hero. Commit `feat(web): beranda page with live data`.

## Task 12: Halaman Fuzzy `/fuzzy`

**Files:**
- Create: `web/apps/web/src/app/fuzzy/page.tsx`, `web/apps/web/src/components/fuzzy/{MembershipChart,RuleTable,Calculator,AggregatedChart}.tsx`
- Test: `web/apps/web/test/calculatorModel.test.ts`

**Interfaces:**
- Consumes: `FUZZY_CONFIG_V1`, `runFuzzy`, `dewPointDepression` (core); `getSeries` untuk "ambil dari data menit".
- Produces: `buildCalculatorModel(input:{deltaP3h:number; rh:number; temp?:number; dpd?:number}): {result:FuzzyResult; dpd:number; activeRules:{no:string; text:string; strength:number}[]}` murni (jika `temp` diberikan, `dpd = dewPointDepression(temp, rh)`; jika keduanya kosong atau tidak masuk akal melempar galat yang ditangkap UI sebagai pesan validasi); `GET /api/fuzzy/minute?ts=ISO` mengembalikan input fuzzy untuk menit itu.

- [ ] **Step 1:** Tes `buildCalculatorModel`: (dp −0,9, rh 87,5, dpd 3) → `activeRules` hanya R5, R8, R14, R17 dengan kekuatan 0,2 / 0,3125 / 0,1 / 0,1; input `temp: 30, rh: 70` → `dpd` ≈ 6,07; tanpa `temp` dan `dpd` → melempar.
- [ ] **Step 2:** Jalankan → FAIL; implementasikan; jalankan → PASS.
- [ ] **Step 3:** Bangun halaman: empat grafik keanggotaan (Recharts atau SVG; kualitas tangkapan layar makalah: label sumbu 13px+, legenda jelas, tanpa animasi), tabel 27 aturan, kalkulator langkah demi langkah (keanggotaan, aturan aktif, grafik agregasi dengan garis centroid, nilai centroid, kategori; teks "fuzzy" boleh dipakai di halaman ini), pemilih menit historis. Tampilkan `config v1` aktif.
- [ ] **Step 4:** Verifikasi di browser: kalkulator memberi 72% atau nilai sesuai `runFuzzy` untuk input mockup; grafik terbaca di terang dan gelap. Commit `feat(web): fuzzy page`.

## Task 13: Riwayat `/riwayat`

**Files:**
- Create: `web/apps/web/src/app/riwayat/page.tsx`, `web/apps/web/src/components/history/{RangePicker,SeriesChart}.tsx`, `web/apps/web/src/lib/range.ts`
- Test: `web/apps/web/test/range.test.ts`

**Interfaces:**
- Produces: `resolveRange(params:{range?:string; from?:string; to?:string}, now:Date): {from:Date; to:Date; preset:'6h'|'24h'|'7d'|'custom'}` (bawaan 24 jam; `from >= to` atau lebih dari 31 hari → jatuh ke bawaan); `SeriesChart({data, series, rainIntervals})` dengan area berarsir untuk hujan.

- [ ] **Step 1:** Tes `resolveRange`: `range=6h` → selisih 6 jam; tanpa param → 24 jam; `from` setelah `to` → bawaan 24 jam; rentang 40 hari → bawaan; ISO tidak valid → bawaan.
- [ ] **Step 2:** Jalankan → FAIL; implementasikan; jalankan → PASS.
- [ ] **Step 3:** Bangun halaman: lima grafik terpisah (suhu DHT22 dan BMP280 satu grafik; kelembapan; tekanan; lux; peluang fuzzy), area berarsir dari `getRainIntervals`, tombol unduh CSV ke `/api/export/readings` dengan rentang yang sama. Rentang panjang (7 hari) dikurangi resolusinya di sisi klien atau kueri (maksimal ±1000 titik per grafik). Keadaan tanpa data per rentang menampilkan teks "Tidak ada data pada rentang ini".
- [ ] **Step 4:** Verifikasi di browser dengan data seed (6 jam, 24 jam, 7 hari, kustom); area hujan sejajar di semua grafik. Commit `feat(web): riwayat page`.

## Task 14: Evaluasi `/evaluasi` dan hitung ulang

**Files:**
- Create: `web/apps/web/src/app/evaluasi/page.tsx`, `web/apps/web/src/app/api/evaluation/recompute/route.ts`, `web/apps/web/src/lib/rateLimit.ts`
- Create: `web/apps/web/src/components/evaluation/{SlotTable,ConfusionMatrix,MetricsTable,Assumptions,RecomputeButton}.tsx`
- Test: `web/apps/web/test/rateLimit.test.ts`

**Interfaces:**
- Consumes: `getEvaluation`, `recomputeEvaluation` (Task 9); `BMKG_MAPPING_TABLE` (core); `getEnv`.
- Produces: `createRateLimiter(opts:{windowMs:number; max:number; now?:()=>number}): (key:string)=>{allowed:boolean; retryAfterSec:number}`; `POST /api/evaluation/recompute` (satu kali per menit per IP; 429 dengan `Retry-After` bila melebihi).

- [ ] **Step 1:** Tes `createRateLimiter`: permintaan pertama diizinkan; kedua dalam jendela yang sama dari kunci sama → `allowed:false` dengan `retryAfterSec` > 0; kunci berbeda tidak saling memengaruhi; setelah jendela lewat (jam palsu) diizinkan lagi.
- [ ] **Step 2:** Jalankan → FAIL; implementasikan; jalankan → PASS.
- [ ] **Step 3:** Bangun halaman: pemilih periode (bawaan `EVAL_START`–`EVAL_END`, kosong → seluruh jendela data), `SlotTable` (waktu slot WIB, peluang fuzzy, prediksi fuzzy, deskripsi BMKG, prediksi BMKG, menit basah, hujan aktual, benar/salah; nilai kosong tampil "—"; slot data tidak lengkap bertanda "data tidak lengkap"), dua `ConfusionMatrix` berdampingan, `MetricsTable` (accuracy, precision, recall, F1, jumlah slot; `null` tampil "—"), `Assumptions` (definisi hujan: menit basah ≥ 30 detik, ≥ `RAIN_MIN_WET_MINUTES` menit basah; ambang prediksi; mode slot BMKG; tabel `BMKG_MAPPING_TABLE`; teks `Sumber: BMKG`), tombol hitung ulang yang menampilkan pesan 429 dengan jelas, dan tombol unduh CSV.
- [ ] **Step 4:** Route `recompute` memanggil `recomputeEvaluation` dengan nilai dari `getEnv` dan rentang `[EVAL_START, EVAL_END]` (kosong → seluruh jendela data), lalu mengembalikan `{slots:number}`; ia memakai `createRateLimiter({windowMs:60000, max:1})` dengan kunci IP dari `x-forwarded-for`.
- [ ] **Step 5:** Verifikasi di browser dengan data seed: skenario `disagree` memberi baris salah untuk satu prediktor; menekan tombol dua kali berturut-turut menghasilkan pesan batas laju pada yang kedua; angka metrik cocok dengan `getEvaluation` yang dipanggil langsung. Commit `feat(web): evaluasi page and recompute endpoint`.

## Task 15: Perangkat `/perangkat`

**Files:**
- Create: `web/apps/web/src/app/perangkat/page.tsx`, `web/apps/web/src/components/device/{DeviceStatusCard,SensorTable,CompletenessChart,LatencyCard,GapList}.tsx`

**Interfaces:**
- Consumes: `getDeviceStatus`, `getLatestReading`, `getCompleteness`, `getLatencyStats`, `getOfflineGaps`, `getBackfillStats` (Task 7).

- [ ] **Step 1:** Bangun halaman: status online/offline, RSSI, uptime, sisa heap, backlog, `buffer_full`, firmware, terakhir terlihat (WIB); tabel status keempat sensor (DHT22, BMP280, BH1750, FC-37; nilai terakhir dan grafik mini 24 jam, dipindah dari mockup lama); batang kelengkapan per hari WIB beserta total; kartu latensi (rata-rata, median, p95) dengan catatan "Latensi bergantung pada sinkronisasi NTP kedua sisi"; jumlah record backfill dan offline terlama; daftar celah data > 5 menit. Semua keadaan kosong menampilkan teks, bukan error.
- [ ] **Step 2:** Verifikasi di browser: skenario `normal` dan `offline`; kelengkapan per hari memakai hari WIB (bandingkan satu hari dengan hitungan `SELECT` langsung); celah offline dari seed muncul di daftar. Commit `feat(web): perangkat page`.

## Task 16: Ekspor CSV

**Files:**
- Create: `web/apps/web/src/lib/csv.ts`, `web/apps/web/src/app/api/export/[kind]/route.ts`
- Test: `web/apps/web/test/csv.test.ts`

**Interfaces:**
- Consumes: kueri Task 7 dan `getEvaluation` (Task 9); `formatWib`.
- Produces: `toCsv(headers:string[], rows:(string|number|boolean|Date|null)[][]): string` (CRLF, kutip ganda untuk sel berisi `,` `"` atau baris baru, `"` digandakan, sel yang diawali `=`, `+`, `-`, `@` diawali `'`, `null` → kosong, `Date` → ISO UTC); `GET /api/export/{readings|rain-events|predictions|bmkg|evaluation}?from=&to=` (`kind` tidak dikenal → 404; rentang tidak valid → 400; header `Content-Disposition: attachment`; kolom waktu dua: `*_utc` dan `*_wib`).

- [ ] **Step 1:** Tes `toCsv`: sel `a,b` → `"a,b"`; sel `he said "hi"` → `"he said ""hi"""`; sel `=1+1` → `'=1+1`; sel `-5` bertipe string → `'-5` tetapi angka `-5` bertipe number tetap `-5`; sel baris baru dikutip; `null` kosong; `Date` ISO.
- [ ] **Step 2:** Jalankan → FAIL; implementasikan `toCsv`; jalankan → PASS.
- [ ] **Step 3:** Implementasikan route handler untuk kelima jenis dengan header snake_case bahasa Inggris yang sama dengan nama kolom database (misalnya `ts_utc`, `ts_wib`, `temp_dht`), agar mudah dipakai di Excel dan skrip analisis makalah. Baris BMKG sintetis ikut diekspor dengan kolom `adm4` apa adanya sehingga mudah disaring.
- [ ] **Step 4:** Verifikasi: `curl -s "http://localhost:3000/api/export/readings?from=...&to=..."` mengembalikan header benar dan jumlah baris sama dengan `SELECT count(*)` untuk rentang itu; `kind=salah` → 404. Commit `feat(web): csv export`.

## Task 17: Pemeriksaan akhir dan dokumentasi web

**Files:**
- Create: `web/README.md`
- Modify: `/CLAUDE.md` (hanya bagian yang tercantum di dokumen desain bagian 11, setelah pengguna menyetujui rencana ini)

- [ ] **Step 1:** `README.md` berisi: struktur, cara membuat proyek Supabase dev dan mengisi `.env.local`, `db:migrate`, seed dan skenarionya, menjalankan web, dan peringatan bahwa seed hanya untuk `dev`.
- [ ] **Step 2:** Jalankan `npm test`, `npm run typecheck`, `npm run build`. Expected: semuanya lulus.
- [ ] **Step 3:** Lewati semua halaman dan ekspor di browser: terang dan gelap, lebar 1440 dan 390, keempat skenario seed; periksa teks `Sumber: BMKG` ada di setiap tempat data BMKG tampil; periksa tidak ada tulisan "fuzzy" di Beranda selain keterangan kecil; periksa `prefers-reduced-motion` mematikan animasi.
- [ ] **Step 4:** Perbarui CLAUDE.md Bagian 2.1 dan 14 sesuai bagian 11 dokumen desain. Commit `docs: web readme and claude.md updates`.
