# Rancangan: Firmware ESP32, Endpoint Ingest HTTP, dan Integrasi BMKG

Tanggal: 2026-11-09. Status: menunggu persetujuan pengguna.

## 1. Maksud

Melengkapi seluruh sistem selain hardware yang belum datang. BMP280 dan FC-37 sudah diuji dan bekerja. DHT22 dan BH1750 belum ada. Firmware harus jalan penuh sekarang: sensor yang belum terpasang dilaporkan "belum terhubung", bukan membuat firmware gagal. Saat sensor dipasang, firmware tidak perlu di-flash ulang.

## 2. Keputusan pengguna (2026-11-09) yang mengubah CLAUDE.md

| Hal | Sebelumnya | Sekarang |
|---|---|---|
| Komunikasi perangkat | WSS `/ws/device` ke ingest service terpisah | **HTTPS POST** ke route handler Next.js `/api/device/ingest` |
| Data live ke server | tiap 10 detik | **tiap 1 menit**, ikut request menit. Baca sensor tetap tiap 10 detik |
| Dashboard real-time | `/ws/live` | polling `/api/live` (sudah ada) |
| RTC DS3231 | opsional lewat flag | **tidak dipakai**, kode RTC tidak ditulis. Hanya NTP |
| Kode wilayah BMKG | env `BMKG_ADM4` | **disetel dari dashboard**, disimpan di `app_config`. Env menjadi nilai awal/cadangan |
| Cron BMKG & evaluasi | di ingest service | di proses Next.js (`instrumentation.ts`) |

Alasan: prediksi berhorizon 3 jam memakai rata-rata 10 menit, evaluasi per slot 3 jam, dan data disimpan per menit. Kiriman tiap 10 detik tidak menambah apa pun bagi penelitian, tetapi enam kali lipat beban TLS di ESP32. HTTP membuat ACK cukup berupa kode 200. Web berjalan terus-menerus di VPS (Docker), jadi bisa menjalankan cron.

CLAUDE.md diperbarui sesuai tabel ini.

## 3. Tujuan, bukan tujuan, anti-tujuan

- **Tujuan:** firmware lengkap (sampling, agregat menit, event hujan, NTP, store-and-forward, watchdog, `TEST_MODE`), endpoint ingest yang menyimpan data dan menghitung fuzzy, pengambilan BMKG tiap jam, evaluasi tiap jam, halaman pengaturan wilayah.
- **Bukan tujuan:** WebSocket, ingest service terpisah, simulator WebSocket, RTC, Docker/Caddy (tahap deployment terpisah).
- **Anti-tujuan:** data hilang diam-diam; token perangkat bisa disadap atau tersimpan sebagai teks biasa; wilayah berubah di tengah periode evaluasi; firmware berhenti karena satu sensor tidak ada.

## 4. Pendekatan yang dipertimbangkan

1. **HTTPS POST ke Next.js (dipilih).** Satu proses server, kode paling sedikit, ACK = HTTP 200.
2. **WSS ke ingest terpisah (rencana lama).** Live 10 detik, tetapi butuh proses tambahan, ACK per-seq, dan timeout. Ditolak karena tidak dibutuhkan penelitian.
3. Pemilihan wilayah: **dropdown bertingkat lewat wilayah.id (dipilih)** vs. kotak cari dengan dataset ~83 ribu kelurahan dibundel. Dropdown dipilih karena tidak menambah data besar ke repo.

## 5. Firmware (`esp/`, PlatformIO, `esp32doit-devkit-v1`)

### 5.1 Konfigurasi
`include/config.h` (di-gitignore), contohnya di `include/config.example.h`:
`WIFI_SSID`, `WIFI_PASS`, `API_URL` (mis. `https://domain/api/device/ingest`), `DEVICE_ID`, `DEVICE_TOKEN`, `RAIN_WET_THRESHOLD` (default 2500), `FW_VERSION`, `TEST_MODE` (0/1), `ROOT_CA` (PEM; default ISRG Root X1 milik Let's Encrypt, dipakai Caddy).

### 5.2 Sensor dan status "belum terhubung"
- Saat boot, tiap sensor dicoba diinisialisasi. Sensor yang gagal dicoba ulang tiap 60 detik.
- BMP280: `begin(0x76)` lalu `0x77`. BH1750: `begin()` di 0x23. DHT22: dianggap terhubung jika ada pembacaan non-NaN dalam 3 percobaan terakhir. FC-37: selalu dianggap terhubung (ADC tidak bisa membedakan "tidak ada" dari "kering").
- Nilai sensor yang tidak terhubung = `null`. Serial mencetak `DHT22: belum terhubung`.
- Status dikirim sebagai `sensors: {"dht22":false,"bmp280":true,"bh1750":false,"rain":true}`.

### 5.3 Siklus (tetap sesuai CLAUDE.md 4.2)
Baca tiap 10 detik. FC-37 diberi daya lewat GPIO 25 selama 100 ms, AO dirata-rata 5 kali, basah jika AO < ambang. Saat menit UTC berganti: rata-rata sampel valid per field, `rain_wet_seconds` = sampel basah × 10, `samples`, `ts` = awal menit. Event hujan: debounce 3 sampel berturut-turut. Tanpa waktu valid (tahun < 2025): tidak membuat record.

### 5.4 Waktu
NTP (`pool.ntp.org`, `id.pool.ntp.org`) saat boot dan tiap 6 jam, UTC. Tanpa RTC.

### 5.5 Pengiriman dan store-and-forward
- Record baru masuk antrean RAM (maks 30).
- Tiap menit, dan segera setelah tersambung kembali: satu `POST` berisi snapshot + record antrean RAM. Jika antrean RAM kosong dan `/pending.ndjson` berisi data, kirim maksimal 50 baris tertua dengan `backfill: true`.
- HTTP 200 berarti semua record di request itu tersimpan (server idempoten). Hapus record dari RAM, atau hapus baris yang terkirim dari file (tulis sisa ke file sementara lalu rename).
- Gagal (tidak tersambung, timeout 10 detik, non-200): record RAM ditambahkan ke `/pending.ndjson`.
- Batas file 1 MB. Jika penuh, record baru dibuang dan `buffer_full: true` dilaporkan.
- 401 (token salah): record tetap disimpan ke file, Serial mencetak peringatan.

### 5.6 Keandalan
WiFi reconnect dengan backoff 5→60 detik, Task WDT 30 detik (di-reset juga di sela request), Serial 115200. HTTPS memakai `WiFiClientSecure` + `ROOT_CA` (bukan `setInsecure`).

### 5.7 TEST_MODE
`TEST_MODE=1`: tanpa WiFi, cetak semua pembacaan dan status sensor ke Serial tiap 2 detik, termasuk AO mentah untuk kalibrasi FC-37.

## 6. Protokol HTTP

`POST /api/device/ingest`, header `Authorization: Bearer <DEVICE_TOKEN>`, `Content-Type: application/json`.

```json
{"device_id":"stasiun-01","fw":"1.0.0",
 "status":{"ts":1762500060,"rssi":-67,"uptime_s":3600,"heap_free":182000,"backlog":0,"buffer_full":false,"time_valid":true,
           "sensors":{"dht22":false,"bmp280":true,"bh1750":false,"rain":true}},
 "records":[
   {"type":"minute","ts":1762500000,"temp_dht":null,"hum_dht":null,"temp_bmp":27.9,"pressure_hpa":985.32,
    "lux":null,"rain_analog_avg":3900,"rain_wet_seconds":0,"samples":6,"backfill":false},
   {"type":"rain_event","ts":1762500130,"state":"start","backfill":false}]}
```

Balasan 200: `{"ok":true,"stored":2,"duplicates":0,"server_time":1762500061}`. 400 jika payload tidak valid (seluruh request ditolak, firmware mencatat dan membuang batch agar antrean tidak macet), 401 jika token salah, 429 jika terkena rate limit.

Server memvalidasi semua field (tipe, rentang wajar, maks 60 record per request). Deduplikasi tetap memakai `UNIQUE(device_id, ts)` dan `UNIQUE(device_id, ts, state)` dengan `ON CONFLICT DO NOTHING`.

## 7. Server (`web/`)

- **Token perangkat:** hash `scrypt` (bawaan `node:crypto`, tanpa dependensi baru; setara bcrypt/argon2 sesuai maksud CLAUDE.md). Format `scrypt$salt$hash`. Dibandingkan dengan `timingSafeEqual`.
- **`npm run device:create -- --id stasiun-01`:** membuat baris `devices`, mencetak token acak 32 byte sekali.
- **Ingest:** validasi, cek token, insert, update `devices` (`last_seen_at`, `last_rssi`, `fw_version`, `last_uptime_s`, `last_heap_free`, `last_backlog`, `last_buffer_full`, kolom baru `last_sensors` jsonb). Untuk setiap menit yang baru tersimpan (backfill atau tidak), jalankan fuzzy (`computeWindowInputs` + `runFuzzy` dari `@ws/core`) dan simpan ke `fuzzy_predictions` (`ON CONFLICT DO NOTHING`).
- **Halaman Perangkat:** tabel sensor menampilkan "belum terhubung" dari `last_sensors`.
- **BMKG:** parser di `packages/core/src/bmkg.ts` ditulis dari respons asli (fixture `packages/core/test/fixtures/bmkg-33.74.12.1001.json`, diambil 2026-11-09). Struktur: `data[0].lokasi`, `data[0].cuaca[hari][slot]`. `analysis_date` tanpa zona dianggap UTC (konsisten dengan `utc_datetime`). Kode atau deskripsi tak dikenal dicatat ke log sebagai peringatan. Penyimpanan `ON CONFLICT (adm4, analysis_date, utc_datetime) DO NOTHING`.
- **Cron (`instrumentation.ts`, runtime nodejs):** cek tiap menit. Menit ke-5 tiap jam: ambil BMKG untuk wilayah aktif. Menit ke-10: hitung ulang evaluasi. BMKG juga diambil sekali saat start. Dijaga flag `globalThis` agar tidak ganda saat hot reload. Asumsi: satu instance web.
- **Wilayah aktif:** `app_config.bmkg_adm4` (+ `bmkg_location` berisi nama lokasi dari BMKG), cadangan env `BMKG_ADM4`, lalu `'SEED'`. Dipakai oleh Beranda, evaluasi, ekspor, dan cron.
- **Pengaturan `/pengaturan`:** dilindungi `ADMIN_PASSWORD` (env). Login membuat cookie httpOnly berisi HMAC; percobaan login dibatasi rate limiter yang ada. Dropdown bertingkat provinsi → kab/kota → kecamatan → kelurahan, bisa diketik untuk menyaring, lewat proxy `GET /api/wilayah/[level]/[kode]` ke `https://wilayah.id/api/...` (cache 1 hari). Sebelum menyimpan, server memanggil BMKG dengan kode tersebut dan menampilkan lokasi balasan BMKG (desa, kecamatan, kota) untuk konfirmasi. Setelah disimpan, BMKG langsung diambil.
- **Kunci:** jika `EVAL_START` terisi dan sekarang ≥ `EVAL_START`, pengaturan wilayah hanya bisa dibaca (ditolak juga di server).
- Atribusi "Sumber: BMKG" di halaman pengaturan, juga di tempat lain yang sudah ada.

## 8. Pengujian

- `core`: parser BMKG terhadap fixture asli (jumlah slot, field, `isRainForecast`), validasi payload ingest.
- `db`/web: hash dan verifikasi token, alur ingest (insert, duplikat, backfill, fuzzy tersimpan) terhadap database dev.
- Firmware: `pio run` harus berhasil dikompilasi. Uji nyata dengan BMP280 + FC-37 terpasang dilakukan pengguna.
- Uji ujung-ke-ujung tanpa ESP: `curl` ke endpoint dengan payload contoh.

## 9. Diserahkan ke pembuat

Nama file di dalam `esp/src`, bentuk komponen dropdown, struktur modul server, pesan Serial.

## 10. Yang harus dilakukan pengguna

Isi `ADMIN_PASSWORD`, jalankan `device:create`, salin token ke `esp/include/config.h`, isi WiFi dan `API_URL`, lalu pilih wilayah di `/pengaturan`. Jika domain memakai proxy Cloudflare, ganti `ROOT_CA`.
