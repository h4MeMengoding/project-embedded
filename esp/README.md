# Firmware ESP32 — Stasiun Cuaca

PlatformIO, framework Arduino, board ESP32 DevKit V1 (`esp32doit-devkit-v1`).
Baca sensor tiap 10 detik, rata-rata per menit, kirim ke server lewat **HTTPS POST** `API_URL` tiap menit.
Saat offline, record disimpan di flash (`/pending.ndjson`, LittleFS, maks 1 MB) lalu dikirim ulang 50 per request.

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

1. Di `web/`: buat token perangkat (sekali; menjalankan lagi membuat token baru):
   ```bash
   npm run device:create -- --id stasiun-01
   ```
2. Salin `include/config.example.h` ke `include/config.h` (di-gitignore), isi `WIFI_SSID`, `WIFI_PASS`,
   `API_URL`, `DEVICE_ID`, `DEVICE_TOKEN`.
   - Produksi: `https://domain-anda/api/device/ingest`. Sertifikat diverifikasi dengan `ROOT_CA`
     (ISRG Root X1, Let's Encrypt/Caddy). Jika domain lewat proxy Cloudflare, ganti `ROOT_CA`.
   - Uji lokal: `http://<ip-laptop>:3000/api/device/ingest` (laptop dan ESP32 di WiFi yang sama).
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
- Tiap menit satu request berisi status (RSSI, uptime, heap, backlog, `buffer_full`, sensor terhubung) dan record baru.
  HTTP 200 = tersimpan. Gagal → record ke flash. 400/413 → batch dibuang (dicatat di Serial). 401 → token salah.
- Watchdog 30 detik, WiFi reconnect dengan jeda 5 → 60 detik. Serial 115200.
