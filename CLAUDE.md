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
2. Data dikirim real-time ke server (VPS) lewat WebSocket dan disimpan ke database.
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
| RTC | **Opsional** (DS3231 belum diputuskan). Kode harus bisa jalan tanpa RTC (pakai NTP), dan mendukung DS3231 lewat flag kompilasi |
| Penyimpanan offline | **Flash internal ESP32 dengan LittleFS** (store-and-forward) |
| Komunikasi | ESP32 → WiFi → **WebSocket (WSS)** → server di VPS |
| Server | **VPS milik pengguna** |
| Database | **PostgreSQL** |
| Dashboard | **Next.js** (App Router, TypeScript) |
| Metode prediksi | **Fuzzy Mamdani** (bukan ML) |
| Horizon prediksi | **3 jam ke depan**, disamakan dengan resolusi prakiraan BMKG |
| Pembanding | **API publik BMKG** `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode}` |
| Kebenaran dasar (ground truth) | **Sensor hujan** milik sendiri |
| Interval baca sensor | **10 detik** |
| Interval simpan ke database | **Rata-rata per 1 menit** |
| Bahasa UI | **Bahasa Indonesia** |
| Zona waktu | Simpan **UTC** di database, tampilkan **Asia/Jakarta (WIB)** |

---

## 2. Arsitektur

```
[Sensor] → [ESP32] --WSS /ws/device--> [ingest service (Node.js)] → [PostgreSQL]
                                              │   ├─ hitung fuzzy tiap menit
                                              │   ├─ cron ambil BMKG tiap 1 jam
                                              │   └─ broadcast ke dashboard
                                              └──WSS /ws/live──> [Browser]
                                [Next.js web] ←── baca DB (server components / route handlers)
                                [Caddy] reverse proxy + HTTPS otomatis
```

**Kenapa ingest dipisah dari Next.js:** koneksi WebSocket permanen dari ESP32 dan cron job tidak cocok dijalankan di dalam route handler Next.js. Ingest service adalah proses Node.js terpisah yang berjalan terus.

### 2.1 Struktur repositori (monorepo, npm workspaces)

> **Pembaruan (web dibangun lebih dulu dari hardware):** `packages/` (`core`, `db`), `tools/seed`, dan `apps/web` kini berada di dalam folder `web/` (monorepo npm workspaces sendiri). `apps/ingest`, `tools/simulator`, dan firmware menyusul; folder firmware sementara bernama `esp/`. Paket dipakai apa adanya oleh ingest nanti. Rancangan: `web/docs/superpowers/specs/2026-11-07-web-dashboard-design.md`.

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
│  └─ db/                     # skema & migrasi (Drizzle ORM), dipakai ingest & web
├─ apps/
│  ├─ ingest/                 # server WebSocket + cron + fuzzy runner
│  └─ web/                    # Next.js dashboard
├─ firmware/                  # PlatformIO, framework Arduino
└─ tools/
   ├─ simulator/              # simulator perangkat (Node.js) untuk uji tanpa hardware
   └─ fuzzy-explain/          # CLI cetak perhitungan fuzzy langkah demi langkah
```

Teknologi: TypeScript di semua bagian Node, **Drizzle ORM**, **vitest**, **Tailwind CSS**, **Recharts** untuk grafik, library **`ws`** untuk server WebSocket.

---

## 3. Hardware dan Wiring

| Komponen | Pin modul | Pin ESP32 | Catatan |
|---|---|---|---|
| BMP280 | SDA / SCL | GPIO 21 / GPIO 22 | I2C, alamat 0x76 (coba 0x77 jika gagal), VCC 3.3V |
| BH1750 (GY-302) | SDA / SCL | GPIO 21 / GPIO 22 | I2C, ADDR ke GND → alamat 0x23, VCC 3.3V |
| DHT22 | DATA | GPIO 4 | Butuh pull-up 10 kΩ (modul biasanya sudah ada) |
| FC-37 | AO | GPIO 34 | **Wajib ADC1** (ADC2 tidak bisa dipakai saat WiFi aktif) |
| FC-37 | VCC | GPIO 25 | Sensor hanya diberi daya saat dibaca untuk mengurangi korosi pelat |
| FC-37 | DO | tidak dipakai | Status basah ditentukan dari AO dengan ambang yang bisa dikalibrasi |
| DS3231 (opsional) | SDA / SCL | GPIO 21 / GPIO 22 | Alamat 0x68, aktif jika `USE_RTC=1` |

Tulis tabel wiring ini juga di `firmware/README.md`.

---

## 4. Firmware ESP32 (`/firmware`)

**Platform:** PlatformIO, framework Arduino, board `esp32dev`.
**Library:** `adafruit/DHT sensor library`, `adafruit/Adafruit BMP280 Library`, `claws/BH1750`, `links2004/WebSockets`, `bblanchon/ArduinoJson` v7, `LittleFS` (bawaan core), `adafruit/RTClib` (hanya jika `USE_RTC=1`).
Partisi: pakai partisi bawaan 4MB (filesystem sekitar 1,5 MB).

### 4.1 Konfigurasi
File `include/config.h` (di-gitignore) dengan contoh `include/config.example.h`:
`WIFI_SSID`, `WIFI_PASS`, `WS_HOST`, `WS_PORT` (443), `WS_PATH` (`/ws/device`), `DEVICE_ID`, `DEVICE_TOKEN`, `USE_RTC` (0/1), `RAIN_WET_THRESHOLD` (nilai ADC, default 2500, harus dikalibrasi), `FW_VERSION`.

### 4.2 Siklus kerja
- **Setiap 10 detik:** baca semua sensor.
  - DHT22: suhu & kelembapan. Jika NaN, tandai sampel tidak valid (jangan dimasukkan ke rata-rata).
  - BMP280: tekanan dalam **hPa (tekanan stasiun/absolut, JANGAN dikonversi ke permukaan laut)** dan suhu.
  - BH1750: lux.
  - FC-37: nyalakan GPIO 25, tunggu 100 ms, baca AO (rata-rata 5 pembacaan), matikan GPIO 25. **Basah jika AO < `RAIN_WET_THRESHOLD`** (FC-37 bernilai lebih rendah saat basah).
- **Kirim pesan `live`** setiap 10 detik jika tersambung (tidak disimpan, tidak di-buffer).
- **Setiap pergantian menit (UTC):** hitung agregat menit dan buat record `minute`:
  - rata-rata suhu DHT, kelembapan, suhu BMP, tekanan, lux, dan AO hujan (hanya dari sampel valid; jika tidak ada yang valid → `null`),
  - `rain_wet_seconds` = jumlah sampel basah × 10,
  - `samples` = jumlah sampel dalam menit itu,
  - `ts` = awal menit dalam Unix epoch detik UTC.
- **Event hujan:** status basah/kering dinyatakan berubah jika **3 sampel berturut-turut** (30 detik) konsisten (debounce). Saat berubah, buat record `rain_event` dengan `state` `"start"` atau `"stop"`.

### 4.3 Waktu
- Sinkronisasi NTP saat boot dan setiap 6 jam (`pool.ntp.org`, `id.pool.ntp.org`), simpan dalam UTC.
- Waktu dianggap **tidak valid** jika tahun < 2025.
- Jika waktu tidak valid: **jangan buat record `minute` dan `rain_event`** (pesan `live` tetap boleh dikirim dengan `ts: null`).
- Jika `USE_RTC=1`: pakai DS3231 saat NTP tidak tersedia, dan setel ulang DS3231 setiap kali NTP berhasil.

### 4.4 Store-and-forward (LittleFS)
- Record `minute` dan `rain_event` disebut **record persisten**.
- Saat tersambung: kirim record, simpan di daftar "menunggu ACK" di RAM (maksimal 30).
- Jika ACK tidak datang dalam 15 detik, atau koneksi putus: pindahkan record yang belum di-ACK ke file **`/pending.ndjson`** (satu JSON per baris).
- Saat tidak tersambung: record langsung ditulis ke `/pending.ndjson`.
- Saat tersambung kembali: kirim isi file dalam batch berisi maksimal 50 record (`minute_batch`), tunggu ACK per batch, lalu lanjut. Setelah semua di-ACK, hapus file.
- Batas ukuran file **1 MB**. Jika penuh, berhenti menulis record baru ke file dan laporkan `buffer_full: true` di pesan `live`.
- Data di file tetap ada meskipun listrik mati.

### 4.5 Keandalan
- Reconnect WiFi dan WebSocket otomatis (backoff 5 detik → maks 60 detik).
- Aktifkan Task Watchdog Timer (30 detik).
- Kirim `ping` WebSocket setiap 30 detik.
- Log ke Serial (115200) untuk debugging.

---

## 5. Protokol WebSocket

Semua pesan berupa JSON. Waktu `ts` dalam **Unix epoch detik UTC**.

### 5.1 Perangkat → server (`/ws/device`)
Autentikasi: query string `?device_id=...&token=...`. Server menolak (tutup koneksi, kode 4001) jika token salah. Token disimpan di DB dalam bentuk hash (bcrypt/argon2).

```json
{"type":"hello","device_id":"stasiun-01","fw":"1.0.0","ts":1762500000}

{"type":"live","device_id":"stasiun-01","ts":1762500010,
 "temp_dht":27.4,"hum_dht":81.2,"temp_bmp":27.9,"pressure_hpa":985.32,
 "lux":12450,"rain_analog":3900,"rain_wet":false,
 "rssi":-67,"uptime_s":3600,"heap_free":182000,"backlog":0,"buffer_full":false,"time_valid":true}

{"type":"minute","seq":101,"device_id":"stasiun-01","ts":1762500000,
 "temp_dht":27.4,"hum_dht":81.2,"temp_bmp":27.9,"pressure_hpa":985.32,
 "lux":12450,"rain_analog_avg":3900,"rain_wet_seconds":0,"samples":6}

{"type":"rain_event","seq":102,"device_id":"stasiun-01","ts":1762500130,"state":"start"}

{"type":"minute_batch","device_id":"stasiun-01","records":[ {...minute/rain_event...} ]}
```

Record di dalam `minute_batch` ditandai `backfill = true` oleh server.

### 5.2 Server → perangkat
```json
{"type":"hello_ack","server_time":1762500001}
{"type":"ack","seqs":[101,102]}
```
`seq` hanya untuk mencocokkan ACK dalam satu sesi (boleh mulai dari 0 lagi setelah reboot). **Deduplikasi di server** memakai kunci unik `(device_id, ts)` untuk minute dan `(device_id, ts, state)` untuk rain_event (`ON CONFLICT DO NOTHING`, tetap kirim ACK).

### 5.3 Server → dashboard (`/ws/live`, hanya baca, tanpa autentikasi)
Broadcast: `live`, `minute`, `rain_event`, `prediction`, `device_status`.

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

1. **ΔP3h (hPa)** = rata-rata tekanan 10 menit terakhir − rata-rata tekanan 10 menit yang berakhir tepat 3 jam sebelumnya.
   Jika salah satu jendela memiliki < 5 menit data valid → status `insufficient_data`.
2. **RH (%)** = rata-rata kelembapan DHT22 10 menit terakhir.
3. **DPD (°C)** = suhu − titik embun, dari rata-rata suhu DHT22 dan RH 10 menit terakhir.
   Titik embun (rumus Magnus, a = 17.62, b = 243.12):
   `γ = ln(RH/100) + (a·T)/(b+T)` lalu `Td = (b·γ)/(a−γ)`. Batasi RH ke [1, 100] sebelum dihitung.

**BH1750 dan sensor hujan TIDAK menjadi input fuzzy.** Lux hanya ditampilkan sebagai data pendukung (nilainya nol di malam hari).

### 7.2 Fungsi keanggotaan (config versi `v1`)

`trap(a,b,c,d)` = trapesium, `tri(a,b,c)` = segitiga. Nilai di luar semesta di-*clamp* ke batas semesta.

| Variabel | Semesta | Himpunan |
|---|---|---|
| ΔP3h (hPa) | [-10, 10] | **Turun** trap(-10,-10,-1.5,-0.3) · **Stabil** tri(-1,0,1) · **Naik** trap(0.3,1.5,10,10) |
| RH (%) | [0, 100] | **Rendah** trap(0,0,60,75) · **Sedang** tri(65,77.5,90) · **Tinggi** trap(85,93,100,100) |
| DPD (°C) | [0, 30] | **Kecil** trap(0,0,1.5,3) · **Sedang** tri(2,4,6) · **Besar** trap(5,8,30,30) |
| Peluang hujan (%) | [0, 100] | **Rendah** trap(0,0,20,40) · **Sedang** tri(30,50,70) · **Tinggi** trap(60,80,100,100) |

### 7.3 Basis aturan (27 aturan, versi `v1`)

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
8. **Prediksi hujan (biner):** `predict_rain = probability ≥ PREDICT_THRESHOLD` (default **50**).

### 7.5 Aturan penting
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
- **API ini tidak menyediakan riwayat.** Karena itu ingest **wajib mengambil dan menyimpan setiap jam** sejak sistem pertama kali menyala (cron di dalam ingest, misalnya `node-cron`, menit ke-5 setiap jam).
- **`BMKG_ADM4` belum diketahui** (kode kelurahan Pakintelan). **Jangan menebak kode.** Buat sebagai variabel env wajib, dan saat startup panggil API sekali lalu log nama lokasi yang dikembalikan supaya pengguna bisa memverifikasi.
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
- **BMKG:** prakiraan untuk slot tersebut dari `analysis_date` **terbaru yang terbit sebelum `slot_start`**.

### 9.4 Metrik
Untuk fuzzy dan BMKG masing-masing, hitung **confusion matrix** (TP, FP, TN, FN), **accuracy, precision, recall, F1-score**, beserta jumlah slot yang dievaluasi. Tangani pembagian dengan nol (tampilkan "—").
Periode evaluasi diatur lewat env `EVAL_START` dan `EVAL_END` (ISO, WIB), juga bisa dipilih di dashboard.

### 9.5 Keandalan sistem
- **Kelengkapan data** = jumlah record `readings_minute` / jumlah menit yang seharusnya dalam periode (%), per hari dan total.
- **Latensi** = `received_at − (ts + 60 detik)` untuk record non-backfill (rata-rata, median, p95). Catat bahwa latensi bergantung pada sinkronisasi NTP kedua sisi.
- Jumlah record backfill dan durasi offline terlama.

Job evaluasi berjalan setiap jam di ingest dan bisa dipicu manual dari dashboard (tombol "Hitung ulang evaluasi").

---

## 10. Variabel Lingkungan (`.env.example`)

```
DATABASE_URL=postgres://...
INGEST_PORT=8080
DEVICE_ID=stasiun-01
DEVICE_TOKEN=ganti-dengan-token-acak
BMKG_ADM4=                      # WAJIB diisi pengguna, jangan ditebak
BMKG_SLOT_MODE=start
PREDICT_THRESHOLD=50
RAIN_MIN_WET_MINUTES=10
EVAL_START=                     # contoh 2026-11-20T00:00:00+07:00
EVAL_END=
DEVICE_OFFLINE_AFTER_SEC=180
PUBLIC_WS_URL=wss://domain-anda/ws/live
DOMAIN=                         # domain/subdomain VPS, ditanyakan ke pengguna
```

---

## 11. Dashboard Next.js (`apps/web`)

Bahasa Indonesia, tampilan bersih, responsif (bisa dibuka di HP), mode terang/gelap. Semua waktu ditampilkan dalam WIB. Data real-time dari `/ws/live`, data historis dari database.

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
- Status online/offline, RSSI, uptime, sisa heap, backlog buffer, `buffer_full`, versi firmware, waktu terakhir terlihat.
- Kelengkapan data per hari (grafik batang) dan total.
- Statistik latensi.
- Daftar periode offline (celah data > 5 menit).

### 11.6 Ekspor CSV
Route handler `/api/export/{readings|rain-events|predictions|bmkg|evaluation}?from=&to=` → CSV dengan header jelas, waktu dalam dua kolom (UTC dan WIB). Tombol unduh di halaman Riwayat dan Evaluasi.

---

## 12. Alat Bantu

### 12.1 Simulator perangkat (`tools/simulator`)
Script Node.js yang berperilaku seperti ESP32: konek ke `/ws/device`, kirim `live` tiap 10 detik dan `minute` tiap menit dengan data sintetis yang realistis (siklus suhu harian, tekanan dengan siklus harian ±1,5 hPa, kejadian hujan acak), termasuk mode **simulasi offline** (putus N menit lalu kirim `minute_batch`). Ada opsi percepatan waktu untuk pengujian. **Seluruh server dan dashboard harus bisa diuji penuh memakai simulator sebelum hardware tersedia.**

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
- **Uji integrasi:** simulator → ingest → database → evaluasi, termasuk skenario offline dan duplikasi data.
- Firmware: sediakan mode `TEST_MODE` yang mencetak semua pembacaan sensor ke Serial tanpa WiFi, untuk uji wiring dan kalibrasi FC-37.

---

## 14. Deployment (VPS)

- `docker-compose.yml` berisi: `ingest`, `web`, `caddy`. **Tidak ada service `postgres`**: `DATABASE_URL` menunjuk ke Postgres terkelola (Supabase; dua proyek `dev` dan `prod`) atau Postgres sendiri. Seed hanya boleh jalan jika `app_config.environment = 'dev'`.
- **Caddy** sebagai reverse proxy dengan HTTPS otomatis:
  - `/ws/device` dan `/ws/live` → ingest,
  - selain itu → web.
- Migrasi database dijalankan otomatis saat ingest start.
- Script `npm run device:create -- --id stasiun-01` untuk membuat perangkat dan mencetak token (hanya sekali).
- Backup: Supabase punya cadangan sendiri, tetapi tetap lakukan ekspor mandiri data penelitian (CSV dari dashboard dan/atau `pg_dump` berkala) karena itu hasil utama makalah.
- `README.md` berisi langkah lengkap: setup VPS, isi `.env`, deploy, flashing firmware, kalibrasi sensor hujan, dan checklist sebelum periode pengambilan data.

---

## 15. Urutan Pengerjaan dan Kriteria Selesai

1. **Scaffold monorepo + skema DB + migrasi.** Selesai jika `docker compose up` menjalankan postgres dan migrasi berhasil.
2. **`packages/core` (fuzzy, meteo, evaluasi) + unit test.** Selesai jika semua test lulus dan `fuzzy:explain` menghasilkan Markdown yang benar.
3. **Ingest service + simulator.** Selesai jika data simulator tersimpan, duplikasi diabaikan, backfill bekerja, dan prediksi fuzzy tersimpan tiap menit.
4. **Integrasi BMKG.** Selesai jika fixture respons asli tersimpan, parser lulus test, dan cron menyimpan prakiraan. (Butuh `BMKG_ADM4` dari pengguna.)
5. **Job evaluasi.** Selesai jika `evaluation_slots` terisi benar untuk data simulator.
6. **Dashboard** (semua halaman Bagian 11 + ekspor CSV).
7. **Firmware ESP32**, termasuk `TEST_MODE` dan store-and-forward.
8. **Deployment** (Docker Compose + Caddy) dan `README.md`.

Setelah setiap tahap, laporkan ke pengguna apa yang selesai dan apa yang perlu ia lakukan (misalnya mengisi env).

---

## 16. Hal yang Harus Ditanyakan ke Pengguna (jangan diasumsikan)

1. **Kode wilayah `BMKG_ADM4`** untuk lokasi pemasangan final.
2. **Domain/subdomain** VPS dan apakah DNS sudah diarahkan ke VPS.
3. Apakah **DS3231** jadi dipakai (`USE_RTC`).
4. **Nilai `RAIN_WET_THRESHOLD`** hasil kalibrasi FC-37 (lewat `TEST_MODE`: catat nilai AO saat kering dan saat ditetesi air).
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
