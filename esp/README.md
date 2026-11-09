# Firmware ESP32 — Stasiun Cuaca

PlatformIO, framework Arduino, board ESP32 DevKit V1 (`esp32doit-devkit-v1`).
Baca sensor tiap 10 detik, rata-rata per menit, kirim ke server lewat **WebSocket (WSS)** `/ws/device`: heartbeat + nilai live tiap 10 detik, record menit dengan `ack`. ESP yang menyambung keluar, jadi boleh di belakang NAT/jaringan lain.
Saat offline, record disimpan di flash (`/pending.ndjson`, LittleFS, maks 1 MB) lalu dikirim ulang 50 per pesan.

## Wiring

| Komponen | Pin modul | Pin ESP32 | Catatan |
|---|---|---|---|
| BMP280 | SDA / SCL | GPIO 21 / GPIO 22 | I2C, alamat 0x76 (otomatis coba 0x77), VCC 3.3V |
| BH1750 (GY-302) | SDA / SCL | GPIO 21 / GPIO 22 | I2C, ADDR ke GND → 0x23, VCC 3.3V |
| DHT22 | DATA | GPIO 4 | Pull-up 10 kΩ (modul biasanya sudah ada) |
| FC-37 | AO | GPIO 34 | Wajib ADC1 (ADC2 tidak bisa dipakai saat WiFi aktif) |
| FC-37 | VCC | GPIO 25 | Diberi daya hanya saat dibaca (kurangi korosi pelat) |
| FC-37 | DO | tidak dipakai | Basah ditentukan dari AO < `RAIN_WET_THRESHOLD` |

Sensor yang belum dipasang tidak menghentikan firmware: nilainya dikirim `null` dan dilaporkan
**"belum terhubung"** (Serial dan halaman Perangkat). Firmware mencoba mendeteksinya lagi tiap 60 detik,
jadi DHT22/BH1750 bisa dicolok belakangan tanpa flash ulang. FC-37 (analog) selalu dianggap terhubung.

## Langkah

1. Di `web/`: buat token perangkat. ID diambil dari `DEVICE_ID` di `web/.env.local`; perintah mencetak dua baris `#define` siap-salin (menjalankan lagi membuat token baru):
   ```bash
   npm run device:create
   ```
2. Salin `include/config.example.h` ke `include/config.h` (di-gitignore), isi `WIFI_SSID`, `WIFI_PASS`,
   `WS_HOST`, `WS_PORT`, `WS_PATH`, `WS_TLS`, `DEVICE_ID`, `DEVICE_TOKEN`.
   - Produksi: `WS_TLS 1`, `WS_HOST "domain-anda"`, `WS_PORT 443`. Sertifikat diverifikasi dengan `ROOT_CA`
     (ISRG Root X1, Let's Encrypt/Caddy). Jika domain lewat proxy Cloudflare, ganti `ROOT_CA`.
   - Uji lokal: `WS_TLS 0`, `WS_HOST "<ip-laptop>"`, `WS_PORT 3000` (laptop dan ESP32 di WiFi yang sama).
3. Flash dan pantau:
   ```bash
   pio run -t upload && pio device monitor
   ```

## Kalibrasi FC-37 (TEST_MODE)

```bash
pio run -e test -t upload && pio device monitor
```
Tanpa WiFi, mencetak semua pembacaan dan status sensor tiap 2 detik. Catat `hujan_ao` saat pelat kering
dan saat ditetesi air, pilih ambang di antaranya, isi `RAIN_WET_THRESHOLD` di `config.h`, lalu flash ulang mode normal.

## Perilaku

- Sampel tiap 10 detik (selaras detik 0,10,…,50 saat jam valid). Rata-rata per menit dari sampel valid; field tanpa sampel valid → `null`.
- `rain_wet_seconds` = jumlah sampel basah × 10. Event hujan `start`/`stop` setelah 3 sampel berturut-turut konsisten (30 detik).
- Waktu dari NTP (`pool.ntp.org`, `id.pool.ntp.org`) saat boot dan tiap 6 jam, UTC. Sebelum jam valid (tahun < 2025) tidak ada record yang dibuat; status tetap dikirim.
- Satu koneksi WebSocket tetap terbuka (ping 15 detik, sambung ulang tiap 5 detik). Pesan pertama `hello` (device_id + token); token salah → server menutup (4401) dan Serial mencetak peringatan.
- Tiap 10 detik satu pesan berisi status (RSSI, uptime, heap, backlog, `buffer_full`, sensor terhubung), `live` (sampel terakhir untuk dashboard realtime) dan record baru.
  Batch record ber-`id`; tersimpan setelah server membalas `ack`. Putus atau ack tidak datang dalam 10 detik → record ke flash dan sambung ulang. `nack` permanen → batch dibuang (dicatat di Serial).
- Watchdog 30 detik, WiFi reconnect dengan jeda 5 → 60 detik. Serial 115200.
