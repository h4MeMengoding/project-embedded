# CLAUDE.md — Stasiun Cuaca IoT + Prediksi Hujan Fuzzy Mamdani

Dokumen ini adalah spesifikasi lengkap untuk seluruh kode proyek. Baca seluruhnya sebelum menulis kode.
Semua keputusan di bagian "Keputusan Final" **sudah disepakati tim dan tidak boleh diubah** tanpa bertanya ke pengguna.
Jika ada hal yang tidak jelas atau tidak tercantum, **tanyakan ke pengguna**, jangan mengarang.

---

## 0. Ringkasan Proyek

Proyek UAS sekaligus makalah jurnal (BEES: Bulletin of Electrical and Electronics Engineering, SINTA 5, bahasa Indonesia).

**Judul sementara makalah:** *Sistem Prediksi Hujan Berbasis IoT dengan Metode Fuzzy Mamdani dan Validasi Terhadap Prakiraan Cuaca BMKG*

**Inti sistem:**
1. Stasiun cuaca mini berbasis ESP32 membaca suhu, kelembapan, tekanan udara, intensitas cahaya, dan status hujan.
2. Data dikirim ke server (VPS) lewat WebSocket (WSS) dan disimpan ke database (record per menit; nilai live tiap 1 detik).
3. Server menghitung **prediksi peluang hujan 3 jam ke depan** dengan **logika fuzzy Mamdani**.
4. Server mengambil **prakiraan cuaca BMKG** (per 3 jam) secara berkala dan menyimpannya.
5. Prediksi fuzzy dan prakiraan BMKG **sama-sama dievaluasi terhadap kejadian hujan aktual** yang tercatat sensor hujan.
6. Semua ditampilkan di **dashboard web Next.js**, termasuk halaman evaluasi dan ekspor CSV untuk makalah.

**Lokasi pemasangan:** Kelurahan Pakintelan, Kecamatan Gunungpati, Kota Semarang (belum 100% pasti).
**Durasi pengambilan data:** sekitar 5–7 hari (singkat). Karena itu **tidak memakai machine learning**, melainkan fuzzy Mamdani yang tidak butuh data latih.

**Tim:** 2 orang (1 fokus paper, 1 fokus hardware). Kode dikerjakan oleh Claude.

---

## 1. Keputusan Final (JANGAN DIUBAH)

| Hal | Keputusan |
|---|---|
| Mikrokontroler | **ESP32 DevKit V1 (ESP-WROOM-32)**, tidak ada slot microSD |
| Sensor | **DHT22** (suhu, kelembapan), **BMP280** (tekanan; juga suhu), **BH1750 / GY-302** (cahaya), **sensor hujan FC-37/YL-83** (basah/kering) |
| Sensor yang TIDAK dipakai | Anemometer, wind vane, rain gauge tipping bucket, SHT31 |
| RTC | **Tidak dipakai** (keputusan 2026-11-09). Waktu hanya dari NTP |
| Penyimpanan offline | **Flash internal ESP32 dengan LittleFS** (store-and-forward) |
| Komunikasi | ESP32 → WiFi → **WebSocket (WSS)** `/ws/device` ke proses web (ESP yang membuka koneksi keluar, jadi tetap jalan di belakang NAT): `hello` (device_id + token), lalu pesan live (status + nilai sensor) tiap 1 detik dan record menit dengan ack; server → browser lewat **WebSocket** `/ws/live` (keputusan 2026-11-09: WSS menggantikan HTTPS POST + SSE) |
| Server | **VPS milik pengguna** |
| Database | **PostgreSQL** |
| Dashboard | **Next.js** (App Router, TypeScript) |
| Metode prediksi | **Fuzzy Mamdani** (bukan ML) |
| Horizon prediksi | **3 jam ke depan**, disamakan dengan resolusi prakiraan BMKG |
| Pembanding | **API publik BMKG** `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode}` |
| Kebenaran dasar (ground truth) | **Sensor hujan** milik sendiri |
| Interval baca sensor | **10 detik** untuk sampel agregasi menit (data penelitian). Pembaruan 2026-11-09: nilai live ke dashboard dibaca dan dikirim tiap **1 detik** (DHT22 menghasilkan nilai baru tiap 2 detik); sampel 10 detik tetap yang dipakai untuk rata-rata menit, event hujan, dan fuzzy |
| Interval simpan ke database | **Rata-rata per 1 menit** |
| Bahasa UI | **Bahasa Indonesia** |
| Zona waktu | Simpan **UTC** di database, tampilkan **Asia/Jakarta (WIB)** |

---

## 2. Arsitektur

```
[Sensor] → [ESP32] --WSS /ws/device (nilai live tiap 1 dtk, record per menit + ack)--> [Next.js web] → [PostgreSQL]
                                                                     ├─ simpan + hitung fuzzy per menit baru
                                                                     ├─ cron (instrumentation.ts): BMKG menit ke-5, evaluasi menit ke-10
                                                                     └─ dashboard: server components + WebSocket /ws/live
                                [Caddy] reverse proxy + HTTPS/WSS otomatis
```

**Pembaruan 2026-11-09:** tidak ada ingest service terpisah. WebSocket (`/ws/device`, `/ws/live`) berjalan di proses yang sama dengan Next.js lewat server kustom `web/apps/web/server.ts` (route handler Next tidak bisa menerima upgrade WebSocket; jalankan dengan `npm run dev` / `npm start`, bukan `next dev`). ESP32 yang menyambung keluar ke VPS, bukan sebaliknya, sehingga ESP boleh berada di jaringan lain di belakang NAT. Web berjalan terus di VPS, sehingga cron BMKG dan evaluasi dijalankan di proses yang sama (asumsi satu instance). Rancangan awal: `web/docs/superpowers/specs/2026-11-09-esp-ingest-bmkg-design.md` (bagian komunikasi sudah digantikan Bagian 5).

### 2.1 Struktur repositori (monorepo, npm workspaces)

> **Pembaruan (web dibangun lebih dulu dari hardware):** `packages/` (`core`, `db`), `tools/seed`, dan `apps/web` kini berada di dalam folder `web/` (monorepo npm workspaces sendiri). Firmware ada di `esp/`. Tidak ada `apps/ingest` (lihat pembaruan di atas). Rancangan: `web/docs/superpowers/specs/2026-11-07-web-dashboard-design.md`.

```
/
├─ CLAUDE.md
├─ README.md                  # cara setup, deploy, kalibrasi
├─ docker-compose.yml
├─ Caddyfile
├─ .env.example
├─ packages/
│  ├─ core/                   # logika murni, TANPA I/O
│  │  ├─ src/fuzzy.ts         # mesin fuzzy Mamdani
│  │  ├─ src/fuzzyConfig.ts   # fungsi keanggotaan & aturan (versi berlabel)
│  │  ├─ src/meteo.ts         # titik embun, dsb.
│  │  ├─ src/evaluation.ts    # penentuan slot, label hujan, metrik
│  │  ├─ src/bmkg.ts          # parser & pemetaan kode cuaca BMKG
│  │  └─ test/*.test.ts       # vitest
│  └─ db/                     # skema & migrasi (Drizzle ORM), ingest perangkat, BMKG
├─ apps/
│  └─ web/                    # Next.js dashboard
├─ firmware/                  # PlatformIO, framework Arduino
└─ tools/
   ├─ simulator/              # simulator perangkat (Node.js) untuk uji tanpa hardware
   └─ fuzzy-explain/          # CLI cetak perhitungan fuzzy langkah demi langkah
```

Teknologi: TypeScript di semua bagian Node, **Drizzle ORM**, **vitest**, **Tailwind CSS**, **Recharts** untuk grafik, `ws` untuk WebSocket server.

---

## 3. Hardware dan Wiring

| Komponen | Pin modul | Pin ESP32 | Catatan |
|---|---|---|---|
| BMP280 | SDA / SCL | GPIO 21 / GPIO 22 | I2C, alamat 0x76 (coba 0x77 jika gagal), VCC 3.3V |
| BH1750 (GY-302) | SDA / SCL | GPIO 32 / GPIO 33 | Bus I2C kedua (`Wire1`, 10 kHz) agar kabel panjang (±5 m) tidak mengganggu BMP280. ADDR ke GND → 0x23, VCC 3.3V. Kabel LAN: SDA dan SCL masing-masing dipilin dengan GND, jangan SDA dengan SCL |
| DHT22 | DATA | GPIO 4 | Butuh pull-up 10 kΩ (modul biasanya sudah ada) |
| FC-37 | AO | GPIO 34 | **Wajib ADC1** (ADC2 tidak bisa dipakai saat WiFi aktif) |
| FC-37 | VCC | GPIO 25 | Sensor hanya diberi daya saat dibaca untuk mengurangi korosi pelat |
| FC-37 | DO | tidak dipakai | Status basah ditentukan dari AO dengan ambang yang bisa dikalibrasi |

Tabel wiring ini juga ada di `esp/README.md`.

---

## 4. Firmware ESP32 (`/esp`)

**Platform:** PlatformIO, framework Arduino, board `esp32doit-devkit-v1`.
**Library:** `adafruit/DHT sensor library`, `adafruit/Adafruit BMP280 Library`, `claws/BH1750`, `bblanchon/ArduinoJson` v7, `links2004/WebSockets`, `LittleFS`.
Partisi: `esp/partitions_ota.csv` (pembaruan 2026-11-11, OTA dipakai): dua slot app 1,5 MB (`app0`/`app1`) + LittleFS ~960 KB. Firmware ~1,4 MB tidak muat di slot OTA bawaan 1,25 MB. Mengganti tabel partisi hanya bisa lewat USB; sesudahnya update lewat OTA (Bagian 4.6).

### 4.1 Konfigurasi
File `include/config.h` (di-gitignore) dengan contoh `include/config.example.h`:
`WIFI_SSID`, `WIFI_PASS`, `WS_HOST`, `WS_PORT`, `WS_PATH` (`/ws/device`), `WS_TLS`, `DEVICE_ID`, `DEVICE_TOKEN`, `RAIN_WET_THRESHOLD` (nilai ADC, default 2500, harus dikalibrasi), `FW_VERSION`, `ROOT_CA` (default ISRG Root X1).

**Sensor belum terpasang:** tiap sensor dideteksi saat boot dan dicoba ulang tiap 60 detik. Sensor yang tidak terhubung bernilai `null` dan dilaporkan "belum terhubung" (Serial, payload `status.sensors`, halaman Perangkat). FC-37 (analog) selalu dianggap terhubung.

### 4.2 Siklus kerja
- **Setiap 1 detik:** baca semua sensor untuk nilai `live` (DHT22 mengembalikan hasil tersimpan antar 2 detik; kegagalan baca sesaat DHT22 memakai nilai valid terakhir pada `live`). **Setiap 10 detik (detik 0,10,…,50):** sampel yang sama juga masuk agregat menit dan debounce hujan; hanya sampel ini yang dihitung ke `minute` (`samples` ≤ 6) dan dicetak ke Serial.
  - DHT22: suhu & kelembapan. Jika NaN, tandai sampel tidak valid (jangan dimasukkan ke rata-rata).
  - BMP280: tekanan dalam **hPa (tekanan stasiun/absolut, JANGAN dikonversi ke permukaan laut)** dan suhu.
  - BH1750: lux.
  - FC-37: nyalakan GPIO 25, tunggu 100 ms, baca AO (rata-rata 5 pembacaan), matikan GPIO 25. **Basah jika AO < `RAIN_WET_THRESHOLD`** (FC-37 bernilai lebih rendah saat basah).
- **Pesan live tiap 1 detik:** status (RSSI, uptime, heap, backlog, `buffer_full`, sensor terhubung) + `live` (sampel terakhir, tidak disimpan) + record baru, lewat satu koneksi WebSocket yang tetap terbuka (ping 15 detik; sambung ulang otomatis tiap 5 detik).
- **Setiap pergantian menit (UTC):** hitung agregat menit dan buat record `minute`:
  - rata-rata suhu DHT, kelembapan, suhu BMP, tekanan, lux, dan AO hujan (hanya dari sampel valid; jika tidak ada yang valid → `null`),
  - `rain_wet_seconds` = jumlah sampel basah × 10,
  - `samples` = jumlah sampel dalam menit itu,
  - `ts` = awal menit dalam Unix epoch detik UTC.
- **Event hujan:** status basah/kering dinyatakan berubah jika **3 sampel berturut-turut** (30 detik) konsisten (debounce). Saat berubah, buat record `rain_event` dengan `state` `"start"` atau `"stop"`.

### 4.3 Waktu
- Sinkronisasi NTP saat boot dan setiap 6 jam (`pool.ntp.org`, `id.pool.ntp.org`), simpan dalam UTC.
- Waktu dianggap **tidak valid** jika tahun < 2025.
- Jika waktu tidak valid: **jangan buat record `minute` dan `rain_event`** (status tetap dikirim dengan `ts: null`).

### 4.4 Store-and-forward (LittleFS)
- Record `minute` dan `rain_event` disebut **record persisten**.
- Record baru masuk antrean RAM (maksimal 30) dan dikirim segera (iterasi loop berikutnya) sebagai satu batch ber-`id`. Batch dianggap tersimpan hanya setelah server membalas `ack` dengan `id` yang sama (server idempoten, jadi kirim ulang aman).
- Belum terautentikasi/tersambung, koneksi putus, atau `ack` tidak datang dalam 10 detik: record ditulis ke **`/pending.ndjson`** (satu JSON per baris) dan koneksi disambung ulang.
- Saat tersambung: isi file dikirim dalam batch maksimal 50 record dengan `backfill: true`, satu batch menunggu `ack` sebelum batch berikutnya (jeda minimal 1 detik); baris yang di-ack dihapus dari file.
- `nack` dengan `permanent: true` (payload ditolak): batch dibuang dan dicatat di Serial agar antrean tidak macet. `nack` tidak permanen (server gagal menyimpan): dicoba lagi setelah 10 detik.
- Batas ukuran file **768 KB** (partisi LittleFS ±960 KB). Jika penuh, record baru dibuang dan `buffer_full: true` dilaporkan.
- Data di file tetap ada meskipun listrik mati.

### 4.5 Keandalan
- Reconnect WiFi otomatis (backoff 5 detik → maks 60 detik).
- Aktifkan Task Watchdog Timer (30 detik).
- WSS dengan verifikasi sertifikat (`ROOT_CA`), bukan `setInsecure`. `WS_TLS 0` hanya untuk uji lokal.
- Log ke Serial (115200) untuk debugging.

### 4.6 OTA (pembaruan 2026-11-11)
ESP32 tidak membuka port apa pun; pembaruan ditarik dari web.
- Admin mengunggah `firmware.bin` di `/pengaturan` (tabel `firmware_images`, 3 terakhir disimpan, hanya image berbyte ajaib 0xE9 dan ≤ 0x180000 byte) lalu menekan "Kirim ke perangkat" (hanya jika perangkat online).
- Server mengirim lewat `/ws/device`: `{"type":"ota","path":"/api/device/firmware/<id>","size":N,"md5":"..."}`.
- ESP32 menyimpan antrean RAM ke flash, memutus WebSocket, mengunduh `https://WS_HOST:WS_PORT<path>` (header `X-Device-Id` + `Authorization: Bearer <DEVICE_TOKEN>`, sertifikat diverifikasi `ROOT_CA`), menulis ke slot OTA, memeriksa MD5, lalu restart. Gagal: firmware lama tetap jalan dan WebSocket tersambung ulang.
- Data berhenti ±1 menit saat OTA. Versi firmware yang berjalan dilaporkan di `hello`/status (`fw`) dan tampil di Pengaturan dan Perangkat. Tanpa rollback otomatis: firmware yang rusak harus dipulihkan lewat USB.

---

## 5. Protokol WebSocket (menggantikan HTTPS POST + SSE, 2026-11-09)

Semua pesan berupa teks JSON. Waktu `ts` dalam **Unix epoch detik UTC**. Server: `web/apps/web/src/lib/wsServer.ts` (dipasang oleh `web/apps/web/server.ts`).

### 5.1 Perangkat → server (`/ws/device`)
ESP32 membuka `wss://domain/ws/device`. Pesan pertama wajib `hello`; token disimpan di DB sebagai hash scrypt (`node:crypto`). Tanpa `hello` valid dalam 5 detik, atau token salah: server membalas `error` lalu menutup dengan kode **4401**. Koneksi baru dari perangkat yang sama menutup koneksi lama (kode 4000). Batas 64 KB per pesan, maksimal 60 record per pesan.

```json
{"type":"hello","device_id":"stasiun-01","token":"<DEVICE_TOKEN>"}
```

Sesudah `hello_ack`, perangkat mengirim pesan data (payload ingest). `id` (bilangan bulat) hanya ada jika `records` tidak kosong; tanpa `id` pesan hanya membawa status + `live` (tiap ~1 detik) dan tidak dibalas. Server menulis status perangkat ke DB paling sering tiap 10 detik untuk pesan tanpa record.

```json
{"id":42,"device_id":"stasiun-01","fw":"1.0.0",
 "status":{"ts":1762500060,"rssi":-67,"uptime_s":3600,"heap_free":182000,"backlog":0,"buffer_full":false,"time_valid":true,
           "sensors":{"dht22":false,"bmp280":true,"bh1750":false,"rain":true}},
 "live":{"ts":1762500060,"temp_dht":null,"hum_dht":null,"temp_bmp":27.9,"pressure_hpa":985.32,"lux":null,"rain_analog":3900,"rain_wet":false},
 "records":[
   {"type":"minute","ts":1762500000,"temp_dht":null,"hum_dht":null,"temp_bmp":27.9,"pressure_hpa":985.32,
    "lux":null,"rain_analog_avg":3900,"rain_wet_seconds":0,"samples":6},
   {"type":"rain_event","ts":1762500130,"state":"start","backfill":true}]}
```

### 5.2 Server → perangkat
- `{"type":"hello_ack","server_time":1762500061}`
- `{"type":"ack","id":42,"stored":2,"duplicates":0}`: semua record di pesan `id` tersimpan.
- `{"type":"nack","id":42,"error":"...","permanent":true}`: payload tidak valid (`permanent: true`, dibuang) atau server gagal menyimpan (`permanent: false`, kirim ulang nanti).
- `{"type":"ota","path":"/api/device/firmware/3","size":1400000,"md5":"<32 hex>"}`: perintah OTA (Bagian 4.6).
- `{"type":"error","error":"..."}`: autentikasi gagal. Penutupan karena terlalu sering: kode 1008 (maks 300 pesan/menit per perangkat; 60 koneksi/menit per IP sebelum autentikasi).

**Deduplikasi di server** memakai kunci unik `(device_id, ts)` untuk minute dan `(device_id, ts, state)` untuk rain_event (`ON CONFLICT DO NOTHING`, tetap di-`ack`). Server mengirim ping WebSocket tiap 15 detik dan memutus koneksi yang tidak membalas.

### 5.3 Dashboard (`/ws/live`)
Browser membuka `ws(s)://host/ws/live` (hanya baca; menyambung ulang sendiri dengan jeda 1 → 15 detik). Event JSON: `live` (tiap pesan live, ~1 detik; yang terakhir dikirim saat tersambung), `minute` (record menit baru → komponen server di-refresh otomatis), `offline` (tidak ada heartbeat selama `DEVICE_OFFLINE_AFTER_SEC`, default 30). `GET /api/live` untuk snapshot saat tersambung dan cadangan tiap 60 detik. Hub event ada di memori proses web (satu instance). Caddy `reverse_proxy` meneruskan upgrade WebSocket tanpa konfigurasi tambahan.

---

## 6. Database (PostgreSQL, Drizzle)

Semua kolom waktu bertipe `timestamptz` (UTC).

**`devices`**: `id` (text PK), `name`, `token_hash`, `created_at`, `last_seen_at`, `last_rssi`, `fw_version`, `last_uptime_s`, `last_heap_free`, `last_backlog`.

**`readings_minute`**: `id` (bigserial), `device_id`, `ts` (awal menit), `temp_dht`, `hum_dht`, `temp_bmp`, `pressure_hpa`, `lux`, `rain_analog_avg`, `rain_wet_seconds`, `samples`, `received_at`, `is_backfill`. **UNIQUE(device_id, ts)**, index pada `ts`.

**`rain_events`**: `id`, `device_id`, `ts`, `state` ('start'|'stop'), `received_at`, `is_backfill`. UNIQUE(device_id, ts, state).

**`fuzzy_predictions`**: `id`, `device_id`, `ts` (waktu prediksi dibuat = awal menit), `config_version`, `delta_p3h`, `rh`, `dew_point`, `dpd`, `memberships` (jsonb), `rule_strengths` (jsonb), `probability` (0–100), `category` ('Rendah'|'Sedang'|'Tinggi'), `predict_rain` (bool), `status` ('ok'|'insufficient_data'). UNIQUE(device_id, ts).

**`bmkg_forecasts`**: `id`, `adm4`, `analysis_date`, `utc_datetime`, `local_datetime`, `t`, `hu`, `weather_code`, `weather_desc`, `tcc`, `ws`, `wd`, `raw` (jsonb), `fetched_at`. UNIQUE(adm4, analysis_date, utc_datetime).

**`evaluation_slots`** (diisi oleh job evaluasi, bisa dihitung ulang): `slot_start`, `slot_end`, `device_id`, `wet_minutes`, `data_minutes`, `actual_rain` (bool|null), `fuzzy_prediction_id`, `fuzzy_predict_rain`, `fuzzy_probability`, `bmkg_forecast_id`, `bmkg_weather_desc`, `bmkg_predict_rain`, `fuzzy_correct`, `bmkg_correct`. UNIQUE(device_id, slot_start).

**`app_config`**: key/value untuk parameter yang bisa diubah dari env (lihat Bagian 10).

---

## 7. Logika Fuzzy Mamdani (`packages/core`)

Mesin fuzzy harus berupa **fungsi murni, deterministik, tanpa library fuzzy eksternal**, supaya setiap langkah bisa dijelaskan di makalah.

### 7.1 Variabel input (dihitung dari `readings_minute`)

1. **ΔP3h (hPa), terkoreksi (v2)** = ΔP3h teramati − koreksi variasi harian.
   - ΔP3h teramati = rata-rata tekanan 10 menit terakhir − rata-rata tekanan 10 menit yang berakhir tepat 3 jam sebelumnya.
   - Koreksi variasi harian (pasang surut atmosfer semidiurnal): `P_tide(h) = A·cos(2π(h − h_puncak)/12)` dengan `h` jam WIB, `A` = 1,0 hPa (nilai awal tipikal wilayah tropis; hanya boleh disetel dari periode kalibrasi), `h_puncak` = 10 (puncak 10.00 dan 22.00 WIB, titik terendah 04.00 dan 16.00 WIB). Koreksi = `P_tide(c) − P_tide(c − 3 jam)` dengan `c` = waktu prediksi − 4 menit (pusat jendela data). Alasan: tanpa koreksi, penurunan tekanan alami dini hari dan sore terbaca sebagai sinyal hujan (alarm palsu dini hari).
   - Jika salah satu jendela memiliki < 5 menit data valid → status `insufficient_data`.
   - `fuzzy_predictions.delta_p3h` menyimpan nilai terkoreksi (masukan fuzzy yang sebenarnya).
2. **RH (%)** = rata-rata kelembapan DHT22 10 menit terakhir.
3. **DPD (°C)** = suhu − titik embun, dari rata-rata suhu DHT22 dan RH 10 menit terakhir.
   Titik embun (rumus Magnus, a = 17.62, b = 243.12):
   `γ = ln(RH/100) + (a·T)/(b+T)` lalu `Td = (b·γ)/(a−γ)`. Batasi RH ke [1, 100] sebelum dihitung.

**BH1750 dan sensor hujan TIDAK menjadi input fuzzy.** Lux hanya ditampilkan sebagai data pendukung (nilainya nol di malam hari).

### 7.2 Fungsi keanggotaan (config versi `v2`; identik dengan `v1`, yang berubah hanya masukan ΔP3h dan aturan keputusan biner)

`trap(a,b,c,d)` = trapesium, `tri(a,b,c)` = segitiga. Nilai di luar semesta di-*clamp* ke batas semesta.

| Variabel | Semesta | Himpunan |
|---|---|---|
| ΔP3h (hPa) | [-10, 10] | **Turun** trap(-10,-10,-1.5,-0.3) · **Stabil** tri(-1,0,1) · **Naik** trap(0.3,1.5,10,10) |
| RH (%) | [0, 100] | **Rendah** trap(0,0,60,75) · **Sedang** tri(65,77.5,90) · **Tinggi** trap(85,93,100,100) |
| DPD (°C) | [0, 30] | **Kecil** trap(0,0,1.5,3) · **Sedang** tri(2,4,6) · **Besar** trap(5,8,30,30) |
| Peluang hujan (%) | [0, 100] | **Rendah** trap(0,0,20,40) · **Sedang** tri(30,50,70) · **Tinggi** trap(60,80,100,100) |

### 7.3 Basis aturan (27 aturan, versi `v1` dan `v2` sama)

Format: JIKA ΔP3h = X DAN RH = Y DAN DPD = Z MAKA Peluang = W.

| No | ΔP3h | RH | DPD | Peluang |
|---|---|---|---|---|
| R1 | Turun | Rendah | Kecil | Sedang |
| R2 | Turun | Rendah | Sedang | Sedang |
| R3 | Turun | Rendah | Besar | Rendah |
| R4 | Turun | Sedang | Kecil | Tinggi |
| R5 | Turun | Sedang | Sedang | Sedang |
| R6 | Turun | Sedang | Besar | Sedang |
| R7 | Turun | Tinggi | Kecil | Tinggi |
| R8 | Turun | Tinggi | Sedang | Tinggi |
| R9 | Turun | Tinggi | Besar | Sedang |
| R10 | Stabil | Rendah | Kecil | Sedang |
| R11 | Stabil | Rendah | Sedang | Rendah |
| R12 | Stabil | Rendah | Besar | Rendah |
| R13 | Stabil | Sedang | Kecil | Sedang |
| R14 | Stabil | Sedang | Sedang | Sedang |
| R15 | Stabil | Sedang | Besar | Rendah |
| R16 | Stabil | Tinggi | Kecil | Tinggi |
| R17 | Stabil | Tinggi | Sedang | Sedang |
| R18 | Stabil | Tinggi | Besar | Sedang |
| R19 | Naik | Rendah | Kecil | Rendah |
| R20 | Naik | Rendah | Sedang | Rendah |
| R21 | Naik | Rendah | Besar | Rendah |
| R22 | Naik | Sedang | Kecil | Sedang |
| R23 | Naik | Sedang | Sedang | Rendah |
| R24 | Naik | Sedang | Besar | Rendah |
| R25 | Naik | Tinggi | Kecil | Sedang |
| R26 | Naik | Tinggi | Sedang | Sedang |
| R27 | Naik | Tinggi | Besar | Rendah |

### 7.4 Inferensi
1. **Fuzzifikasi:** hitung derajat keanggotaan semua himpunan.
2. **Operator AND:** `min`.
3. **Implikasi:** `min` (memotong himpunan output).
4. **Agregasi:** `max`.
5. **Defuzzifikasi:** **centroid** pada semesta output 0–100 dengan langkah 0,5.
6. Jika semua kekuatan aturan = 0, hasil = 0 dan catat sebagai kasus khusus.
7. **Kategori:** kategori output dengan derajat keanggotaan tertinggi pada nilai crisp.
8. **Prediksi hujan (biner), v2:** peluang dibulatkan ke 1 desimal terlebih dahulu, lalu `predict_rain = round1(probability) > PREDICT_THRESHOLD` (default **50**; tepat 50,0 dinyatakan tidak hujan). Pada v1 aturannya `≥ 50`.

### 7.5 Aturan penting
- Riwayat versi: **v1** = ΔP3h mentah, ambang `≥ 50`. **v2** = ΔP3h terkoreksi variasi harian, ambang `> 50` dengan pembulatan 1 desimal; fungsi keanggotaan dan 27 aturan tidak berubah. Konfigurasi aktif: `ACTIVE_FUZZY_CONFIG` (v2).
- **v3 (kandidat, BELUM aktif):** sama dengan v2 kecuali R16 (Stabil, RH Tinggi, DPD Kecil): Tinggi → Sedang, dengan prinsip "peluang Tinggi hanya jika tekanan turun". Diaktifkan hanya setelah keputusan model utama dari laporan kalibrasi; v2, v3, dan ambang `> 50` (pembulatan 1 desimal) dibekukan sebelum `EVAL_START`. Catatan: pada tekanan stabil dan RH jenuh, v3 menghasilkan peluang tepat 50,0, sehingga keputusannya bergantung pada aturan `>` dan pembulatan.
- Semua parameter di atas disimpan di `fuzzyConfig.ts` dengan **`config_version`**. Setiap prediksi menyimpan versi config yang dipakai.
- **Integritas penelitian:** parameter fuzzy hanya boleh diubah **sebelum** periode evaluasi dimulai. Dashboard harus menampilkan versi config yang aktif.
- Fungsi utama mengembalikan objek lengkap: input, derajat keanggotaan, kekuatan tiap aturan, himpunan output yang terpotong, nilai crisp, kategori. Objek ini dipakai untuk penjelasan di dashboard dan makalah.

### 7.6 Kapan fuzzy dijalankan
- Ingest menjalankan fuzzy **setiap kali record `minute` baru (non-backfill) masuk**, dan menyimpan hasilnya ke `fuzzy_predictions`.
- Untuk data backfill, jalankan ulang fuzzy untuk menit-menit tersebut setelah batch tersimpan (agar tidak ada celah prediksi).

---

## 8. Integrasi BMKG

- Endpoint: `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={BMKG_ADM4}`.
- Data berisi prakiraan 3 hari, per 3 jam, diperbarui 2 kali sehari. Batas akses 60 permintaan per menit per IP.
- **API ini tidak menyediakan riwayat.** Karena itu server **wajib mengambil dan menyimpan setiap jam** sejak sistem pertama kali menyala (cron di proses Next.js, `instrumentation.ts`, menit ke-5 setiap jam, plus sekali saat start).
- **Kode wilayah disetel dari dashboard** (`/pengaturan`, dilindungi `ADMIN_PASSWORD`), disimpan di `app_config.bmkg_adm4`; env `BMKG_ADM4` hanya cadangan. Pilihan bertingkat provinsi → kab/kota → kecamatan → kelurahan dari wilayah.id (kode Kemendagri = adm4 BMKG). Sebelum disimpan, server memanggil BMKG dan menampilkan lokasi balasan BMKG untuk diverifikasi. **Jangan menebak kode.** Terkunci setelah `EVAL_START`. Pakintelan = `33.74.12.1001` (terverifikasi ke BMKG 2026-11-09).
- **Parser harus disesuaikan dengan respons asli.** Ambil satu respons nyata terlebih dahulu, simpan sebagai fixture di `packages/core/test/fixtures/`, dan tulis parser berdasarkan struktur sebenarnya. Field yang diketahui: `utc_datetime`, `local_datetime`, `t`, `hu`, `weather`, `weather_desc`, `ws`, `wd`, `tcc`, `vs_text`, `analysis_date`.
- **Pemetaan ke "prediksi hujan":** `bmkg_predict_rain = true` jika `weather_desc` mengandung kata **"Hujan"** (tidak peka huruf besar/kecil) atau kode cuaca termasuk {60, 61, 63, 80, 95, 97}. Kode/deskripsi yang tidak dikenal dicatat ke log sebagai peringatan. Tampilkan tabel pemetaan ini di halaman evaluasi.
- **Atribusi wajib:** setiap tempat yang menampilkan data BMKG harus menampilkan teks **"Sumber: BMKG"**.

---

## 9. Evaluasi (inti hasil makalah)

### 9.1 Slot waktu
- Slot = interval 3 jam yang **mengikuti waktu prakiraan BMKG** (`utc_datetime` dari data yang tersimpan).
- Asumsi default: prakiraan BMKG pada waktu T mewakili interval **[T, T+3 jam)**. Buat ini bisa diubah lewat env `BMKG_SLOT_MODE` = `start` (default) atau `center` (interval [T−1,5 jam, T+1,5 jam)). Tampilkan asumsi yang dipakai di halaman evaluasi.

### 9.2 Hujan aktual per slot
- **Menit basah** = menit dengan `rain_wet_seconds ≥ 30`.
- **`actual_rain = true`** jika jumlah menit basah dalam slot **≥ `RAIN_MIN_WET_MINUTES`** (default **10**).
- Jika data menit dalam slot < 80% (kurang dari 144 dari 180 menit) → `actual_rain = null` dan slot **dikecualikan** dari metrik (tetap ditampilkan dengan tanda "data tidak lengkap").

### 9.3 Prediksi yang dibandingkan
- **Fuzzy:** prediksi yang dibuat pada menit valid terakhir **sebelum** `slot_start` (maksimal 10 menit sebelumnya). Menit `slot_start` sendiri tidak dipakai karena record menit itu mencakup 60 detik setelah `slot_start`. Tidak boleh memakai data setelah `slot_start`.
- **BMKG:** prakiraan untuk slot tersebut dari `analysis_date` **terbaru yang terbit sebelum `slot_start`**. Karena `analysis_date` adalah waktu run model (bukan waktu terbit), prakiraan juga harus sudah diambil server (`fetched_at`) sebelum `slot_start`.

### 9.4 Metrik
Untuk fuzzy dan BMKG masing-masing, hitung **confusion matrix** (TP, FP, TN, FN), **accuracy, precision, recall, F1-score**, beserta jumlah slot yang dievaluasi. Tangani pembagian dengan nol (tampilkan "—").
- **F1 = 2TP / (2TP + FP + FN)**; "—" hanya jika TP, FP, dan FN semuanya 0.
- **Himpunan slot yang sama:** metrik fuzzy dan BMKG hanya dihitung pada slot yang telah selesai, berdata sensor lengkap, dan memiliki prediksi fuzzy serta prakiraan BMKG sekaligus. Dashboard menampilkan jumlah slot yang dikecualikan beserta alasannya: periode kalibrasi, belum dimulai, sedang berjalan, data tidak lengkap, tanpa prediksi fuzzy, tanpa prakiraan BMKG. Slot sedang berjalan diberi label "sedang berjalan", bukan "data tidak lengkap".
Periode evaluasi diatur lewat env `EVAL_START` dan `EVAL_END` (ISO, WIB), juga bisa dipilih di dashboard. Jika kosong, dashboard menampilkan "Semua data".

### 9.4a Periode kalibrasi
- Env `CALIB_START` dan `CALIB_END` (ISO, WIB; 1–2 hari pertama data sungguhan). `CALIB_END` harus ≤ `EVAL_START`.
- Parameter fuzzy (mis. amplitudo koreksi tekanan) **hanya boleh disesuaikan berdasarkan periode kalibrasi**. Setelah `EVAL_START` parameter dibekukan (lihat 7.5).
- Slot yang beririsan dengan periode kalibrasi dikecualikan dari metrik makalah, apa pun rentang yang dipilih di dashboard.
- **Laporan kalibrasi:** `npm run calib:report` (dari `web/`; opsi `--from`, `--to`, `--device`, `--out`) menulis `web/reports/kalibrasi-<device>-<tanggal>.md` dan `.csv` dari `CALIB_START`–`CALIB_END`: rata-rata RH, DPD, ΔP3h terkoreksi/mentah per jam WIB; laju alarm palsu dan recall per jam untuk v2 dan simulasi v3; ringkasan menit; estimasi harmonik 12 jam tekanan (amplitudo, puncak) sebagai dasar penyetelan; masukan fuzzy 3 jam sebelum tiap kejadian hujan. Label hujan memakai data 3 jam berikutnya yang berada di dalam periode (tanpa kebocoran data). Laporan ini bahan keputusan, bukan metrik makalah.

### 9.5 Keandalan sistem
- **Kelengkapan data** = jumlah record `readings_minute` / jumlah menit yang seharusnya dalam periode (%), per hari dan total.
- **Latensi** = `received_at − (ts + 60 detik)` untuk record non-backfill (rata-rata, median, p95). Catat bahwa latensi bergantung pada sinkronisasi NTP kedua sisi.
- Jumlah record backfill dan durasi offline terlama.

Job evaluasi berjalan setiap jam (menit ke-10) di proses Next.js dan bisa dipicu manual dari dashboard (tombol "Hitung ulang evaluasi").

---

## 10. Variabel Lingkungan (`.env.example`)

```
DATABASE_URL=postgres://...
DEVICE_ID=stasiun-01
BMKG_ADM4=                      # cadangan; normalnya disetel di /pengaturan
ADMIN_PASSWORD=                 # untuk /pengaturan
DISABLE_JOBS=                   # 1 = matikan cron BMKG/evaluasi
BMKG_SLOT_MODE=start
PREDICT_THRESHOLD=50
RAIN_MIN_WET_MINUTES=10
CALIB_START=                    # 1-2 hari pertama data sungguhan
CALIB_END=                      # harus <= EVAL_START
EVAL_START=                     # contoh 2026-11-20T00:00:00+07:00
EVAL_END=
DEVICE_OFFLINE_AFTER_SEC=30            # pesan live ESP tiap 1 detik
DOMAIN=                         # domain/subdomain VPS, ditanyakan ke pengguna
```

---

## 11. Dashboard Next.js (`apps/web`)

Bahasa Indonesia, tampilan bersih, responsif (bisa dibuka di HP), mode terang/gelap. Semua waktu ditampilkan dalam WIB. Data terbaru lewat WebSocket `/ws/live` (cadangan: polling `/api/live`), data historis dari database.

### 11.1 Beranda `/`
- Kartu: suhu (DHT22), kelembapan, tekanan, intensitas cahaya, titik embun, status hujan (Hujan/Tidak hujan), waktu data terakhir.
- Indikator perangkat **Online/Offline** (offline jika data terakhir > `DEVICE_OFFLINE_AFTER_SEC`).
- **Prediksi 3 jam ke depan:** peluang (%) dalam bentuk gauge, kategori, versi config fuzzy.
- **Prakiraan BMKG** untuk slot saat ini dan 2 slot berikutnya, dengan "Sumber: BMKG".
- Lencana **"Fuzzy dan BMKG sepakat / berbeda"**.
- Jika fuzzy `insufficient_data`: tampilkan "Menunggu 3 jam data tekanan".

### 11.2 Riwayat `/riwayat`
- Pilihan rentang: 6 jam, 24 jam, 7 hari, kustom.
- Grafik terpisah: suhu (DHT22 dan BMP280 dalam satu grafik), kelembapan, tekanan, lux, peluang hujan fuzzy.
- **Area berarsir** pada waktu hujan (dari `rain_events` / menit basah) di semua grafik.

### 11.3 Evaluasi `/evaluasi`
- Pemilih periode (default `EVAL_START`–`EVAL_END`).
- Tabel per slot: waktu slot (WIB), peluang fuzzy, prediksi fuzzy, prakiraan BMKG (deskripsi), prediksi BMKG, menit basah, hujan aktual, benar/salah untuk masing-masing. Slot data tidak lengkap ditandai.
- Dua **confusion matrix** berdampingan (Fuzzy vs BMKG).
- Tabel metrik perbandingan: accuracy, precision, recall, F1, jumlah slot.
- Keterangan asumsi: definisi hujan, ambang prediksi, mode slot BMKG, tabel pemetaan BMKG.
- Tombol "Hitung ulang evaluasi".

### 11.4 Fuzzy `/fuzzy`
- Grafik keempat fungsi keanggotaan (kualitas cukup baik untuk tangkapan layar makalah).
- Tabel 27 aturan.
- **Kalkulator:** masukkan ΔP3h, RH, suhu (atau DPD) secara manual, lalu tampilkan langkah demi langkah: derajat keanggotaan, kekuatan tiap aturan yang aktif, grafik output teragregasi, nilai centroid, kategori.
- Pilihan "ambil dari data menit tertentu" untuk menjelaskan prediksi historis.

### 11.5 Perangkat `/perangkat`
- Status online/offline, sensor terhubung/belum terhubung, RSSI, uptime, sisa heap, backlog buffer, `buffer_full`, versi firmware, waktu terakhir terlihat.
- Kelengkapan data per hari (grafik batang) dan total.
- Statistik latensi.
- Daftar periode offline (celah data > 5 menit).

### 11.5a Pengaturan `/pengaturan`
- Login `ADMIN_PASSWORD` (cookie httpOnly). Halaman lain tetap publik.
- Pemilihan wilayah BMKG bertingkat, cek ke BMKG, simpan. Terkunci setelah `EVAL_START`.
- **Mode operasi (2026-11-11)**, `app_config.mode` (`prod` default, bukan `app_config.environment`). **Prod:** perilaku normal; memilih prod wajib wilayah BMKG sudah disetel (jika belum, diminta memilih dulu). **Dev:** record ESP32 di-ack lalu dibuang (hanya status perangkat ditulis), cron BMKG dan evaluasi berhenti, Beranda hanya menampilkan pembacaan live semua sensor. Dev tidak bisa dipilih setelah `EVAL_START`.
- **Reset database** (hanya mode prod, ketik `RESET`): hapus `readings_minute`, `rain_events`, `fuzzy_predictions`, `bmkg_forecasts`, `evaluation_slots`; perangkat/token, wilayah, firmware, dan pengaturan tetap. Dipakai untuk mengulang penelitian.

### 11.6 Ekspor CSV
Route handler `/api/export/{readings|rain-events|predictions|bmkg|evaluation}?from=&to=` → CSV dengan header jelas, waktu dalam dua kolom (UTC dan WIB). Tombol unduh di halaman Riwayat dan Evaluasi.

---

## 12. Alat Bantu

### 12.1 Simulator perangkat (`tools/simulator`)
Script Node.js yang berperilaku seperti ESP32: menyambung ke `/ws/device` (hello, pesan live 1 detik, record per menit dengan ack) dengan data sintetis yang realistis (siklus suhu harian, tekanan dengan siklus harian ±1,5 hPa, kejadian hujan acak), termasuk mode **simulasi offline** (putus N menit lalu kirim record tertunda dengan `backfill: true`). Ada opsi percepatan waktu untuk pengujian. **Seluruh server dan dashboard harus bisa diuji penuh memakai simulator sebelum hardware tersedia.**

### 12.2 Fuzzy explain (`tools/fuzzy-explain`)
CLI: `npm run fuzzy:explain -- --dp -1.2 --rh 88 --t 26.5` mencetak perhitungan langkah demi langkah dalam format **Markdown** (tabel keanggotaan, aturan aktif dengan nilai min, agregasi, centroid). Hasilnya akan dipakai untuk subbab "Contoh Perhitungan Fuzzy" di makalah.

---

## 13. Pengujian

- **Unit test (vitest)** untuk `packages/core`:
  - fungsi keanggotaan di titik batas (a, b, c, d),
  - titik embun dibandingkan nilai acuan (misalnya T = 30 °C, RH = 70% → Td ≈ 23,9 °C),
  - minimal 5 kasus fuzzy dengan hasil yang dihitung manual,
  - penentuan slot, label hujan aktual (termasuk kasus data tidak lengkap), dan metrik (termasuk pembagian nol),
  - parser BMKG terhadap fixture respons asli.
- **Uji integrasi:** simulator → `/ws/device` → database → evaluasi, termasuk skenario offline dan duplikasi data.
- Firmware: pembacaan sensor dicetak ke Serial tiap 10 detik (termasuk `hujan_ao`) untuk uji wiring dan kalibrasi FC-37. Tidak ada mode uji terpisah (dihapus 2026-11-09).

---

## 14. Deployment (VPS)

- `docker-compose.yml` berisi: `web`, `caddy`. **Tidak ada service `postgres`**: `DATABASE_URL` menunjuk ke Postgres terkelola (Supabase; dua proyek `dev` dan `prod`) atau Postgres sendiri. Seed hanya boleh jalan jika `app_config.environment = 'dev'`.
- **Caddy** sebagai reverse proxy dengan HTTPS otomatis:
  - semua → web (termasuk upgrade WebSocket `/ws/device` dan `/ws/live`).
- Migrasi database dijalankan otomatis saat web start.
- Script `npm run device:create -- --id stasiun-01` untuk membuat perangkat dan mencetak token (hanya sekali).
- Backup: Supabase punya cadangan sendiri, tetapi tetap lakukan ekspor mandiri data penelitian (CSV dari dashboard dan/atau `pg_dump` berkala) karena itu hasil utama makalah.
- `README.md` berisi langkah lengkap: setup VPS, isi `.env`, deploy, flashing firmware, kalibrasi sensor hujan, dan checklist sebelum periode pengambilan data.

---

## 15. Urutan Pengerjaan dan Kriteria Selesai

1. **Scaffold monorepo + skema DB + migrasi.** Selesai jika `docker compose up` menjalankan postgres dan migrasi berhasil.
2. **`packages/core` (fuzzy, meteo, evaluasi) + unit test.** Selesai jika semua test lulus dan `fuzzy:explain` menghasilkan Markdown yang benar.
3. **Endpoint ingest WebSocket + simulator.** Selesai jika data simulator tersimpan, duplikasi diabaikan, backfill bekerja, dan prediksi fuzzy tersimpan tiap menit.
4. **Integrasi BMKG.** Selesai jika fixture respons asli tersimpan, parser lulus test, dan cron menyimpan prakiraan. (Wilayah disetel pengguna di `/pengaturan`.)
5. **Job evaluasi.** Selesai jika `evaluation_slots` terisi benar untuk data simulator.
6. **Dashboard** (semua halaman Bagian 11 + ekspor CSV).
7. **Firmware ESP32**, termasuk store-and-forward.
8. **Deployment** (Docker Compose + Caddy) dan `README.md`.

Setelah setiap tahap, laporkan ke pengguna apa yang selesai dan apa yang perlu ia lakukan (misalnya mengisi env).

---

## 16. Hal yang Harus Ditanyakan ke Pengguna (jangan diasumsikan)

1. **Kode wilayah BMKG** untuk lokasi pemasangan final (disetel di `/pengaturan`).
2. **Domain/subdomain** VPS dan apakah DNS sudah diarahkan ke VPS.
3. ~~DS3231~~ — diputuskan tidak dipakai (2026-11-09).
4. **Nilai `RAIN_WET_THRESHOLD`** hasil kalibrasi FC-37 (lewat log Serial: catat nilai `hujan_ao` saat kering dan saat ditetesi air).
5. Tanggal **`EVAL_START` dan `EVAL_END`**.
6. Apakah dashboard perlu password (default: publik, hanya baca).

---

## 17. Larangan

- Jangan mengganti fuzzy Mamdani dengan ML atau metode lain.
- Jangan menambah sensor yang tidak ada di Bagian 1.
- Jangan menebak kode wilayah BMKG atau format respons BMKG tanpa memeriksa respons asli.
- Jangan menghilangkan atribusi "Sumber: BMKG".
- Jangan mengubah parameter fuzzy tanpa menaikkan `config_version`.
- Jangan memakai data setelah `slot_start` untuk prediksi yang dievaluasi pada slot tersebut.
- Jangan menyimpan token perangkat dalam bentuk teks biasa di database.
