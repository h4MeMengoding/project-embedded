# Wiring Stasiun Cuaca (ESP32 DevKit V1)

Panduan pemasangan semua sensor ke ESP32 DevKit V1 (ESP-WROOM-32). Nomor pin sama dengan
`src/sensors.h` (`PIN_SDA`, `PIN_SCL`, `PIN_DHT`, `PIN_RAIN_AO`, `PIN_RAIN_PWR`).

> **Matikan daya (cabut USB) setiap kali mengubah kabel.** Semua modul memakai **3.3V**.

## 1. Ringkasan pin

| Sensor | Pin modul | Pin ESP32 | Catatan |
|---|---|---|---|
| BMP280 | VCC | 3V3 | |
| | GND | GND | |
| | SDA | GPIO 21 | Jalur I2C bersama |
| | SCL | GPIO 22 | Jalur I2C bersama |
| | CSB | 3V3 | Wajib, memilih mode I2C (modul 6 pin) |
| | SDO (SDD) | GND | Alamat I2C 0x76 |
| BH1750 (GY-302) | VCC | 3V3 | |
| | GND | GND | |
| | SDA | GPIO 21 | Jalur I2C bersama |
| | SCL | GPIO 22 | Jalur I2C bersama |
| | ADDR | GND (atau dibiarkan) | Alamat 0x23 |
| DHT22 | VCC (+) | 3V3 | |
| | DATA (OUT) | GPIO 4 | Pull-up 10 kΩ ke 3V3 |
| | GND (-) | GND | |
| FC-37 / YL-83 | VCC | GPIO 25 | Diberi daya hanya saat dibaca |
| | GND | GND | |
| | AO | GPIO 34 | Wajib ADC1 |
| | DO | tidak dipakai | Basah ditentukan dari AO |

## 2. Diagram

```
                      ESP32 DevKit V1
                  ┌───────────────────────┐
                  │  3V3  ●───────────────┼──┬──── VCC  BMP280
                  │                       │  ├──── VCC  BH1750
                  │                       │  └──── VCC  DHT22   (+ pull-up 10k ke DATA)
                  │  GND  ●───────────────┼──┬──── GND  semua sensor
                  │                       │  │
                  │  GPIO21 (SDA) ●───────┼──┬──── SDA  BMP280
                  │                       │  └──── SDA  BH1750
                  │  GPIO22 (SCL) ●───────┼──┬──── SCL  BMP280
                  │                       │  └──── SCL  BH1750
                  │  GPIO4  ●─────────────┼─────── DATA DHT22
                  │  GPIO25 ●─────────────┼─────── VCC  FC-37 (modul pembanding)
                  │  GPIO34 ●─────────────┼─────── AO   FC-37
                  └───────────────────────┘

   FC-37: pelat sensor ──(2 kabel)── modul pembanding (LM393) ── VCC/GND/AO ke ESP32
```

## 3. Detail tiap sensor

### 3.1 BMP280 (tekanan, suhu) - I2C
- Modul 6 pin (VCC, GND, SCL, SDA, CSB, SDO): **CSB ke 3V3** (mode I2C) dan **SDO ke GND** (alamat 0x76).
  Jangan biarkan CSB/SDO mengambang. Modul 4 pin (tanpa CSB/SDO) tidak perlu langkah ini.
- SDO ke 3V3 → alamat **0x77**. Firmware mencoba 0x76 lalu 0x77 otomatis.
- Jangan beri 5V pada modul yang tidak memiliki regulator.
- Tekanan yang dibaca adalah **tekanan stasiun (absolut)**, tidak dikonversi ke permukaan laut.

### 3.2 BH1750 / GY-302 (cahaya) - I2C
- ADDR ke GND (atau dibiarkan mengambang pada modul GY-302) → alamat **0x23**.
- ADDR ke 3V3 → alamat 0x5C. Firmware memakai 0x23, jadi jangan ke 3V3.
- Letakkan sensor menghadap langit, tidak tertutup casing buram.

### 3.3 DHT22 (suhu, kelembapan)
- Modul 3 pin: pull-up 10 kΩ biasanya sudah ada di board, tidak perlu resistor tambahan.
- DHT22 polos 4 pin (lihat dari depan, sisi berlubang jaring, pin ke bawah, kiri ke kanan):

  | Pin | Fungsi |
  |---|---|
  | 1 | VCC |
  | 2 | DATA → GPIO 4 |
  | 3 | tidak dipakai |
  | 4 | GND |

  Pasang resistor **10 kΩ antara DATA dan VCC**.
- Sensor hanya menghasilkan nilai baru tiap 2 detik.
- Taruh di tempat teduh dan berventilasi, jauh dari ESP32 yang hangat, agar suhu tidak bias.

### 3.4 FC-37 / YL-83 (sensor hujan)
- Pelat sensor dihubungkan ke modul pembanding dengan 2 kabel (polaritas bebas).
- **VCC modul ke GPIO 25**, bukan ke 3V3: firmware menyalakan GPIO 25 hanya ±100 ms saat membaca
  agar pelat tidak cepat berkarat (korosi elektrolisis).
- **AO ke GPIO 34** (ADC1, input saja). Jangan pakai pin ADC2 (GPIO 0, 2, 4, 12-15, 25-27): tidak
  bisa dibaca saat WiFi aktif. GPIO 25 hanya sebagai catu daya (output digital), jadi aman.
- Beri daya modul **3.3V saja**. Pada 5V, tegangan AO bisa melebihi 3.3V dan merusak ADC ESP32.
- Nilai AO **turun saat basah**. Status basah jika AO < `RAIN_WET_THRESHOLD` (default 2500 di
  `include/config.h`). Nilai ini **harus dikalibrasi** (bagian 5).
- Pin DO tidak dipakai. Potensiometer di modul tidak berpengaruh pada AO.
- Pasang pelat miring ±30° dan menghadap langit agar air tidak menggenang.

## 4. Catatan listrik

- Tiga sensor I2C/DHT22 lewat 3V3 ESP32 (regulator papan, ±600 mA), beban totalnya jauh di bawah itu.
- Modul FC-37 diberi daya dari GPIO 25 (sekitar 5-15 mA). Masih dalam batas, tetapi jika modul tidak
  stabil, ganti dengan transistor/MOSFET sebagai saklar.
- I2C: modul GY-302 dan BMP280 umumnya sudah punya pull-up 4.7-10 kΩ di board. Dua modul paralel
  tidak masalah. Kabel I2C sebaiknya < 30 cm.
- Beri kapasitor 100 nF dekat VCC-GND tiap sensor jika pembacaan berisik.
- Daya ESP32 lewat USB 5V (power bank atau adaptor stabil minimal 1 A).

## 5. Pengujian dan kalibrasi

1. Buka Serial Monitor (115200 baud). Tiap 10 detik tercetak pembacaan semua sensor, termasuk `hujan_ao`.
2. Sensor yang tidak terdeteksi dilaporkan **"belum terhubung"** dan dicoba ulang tiap 60 detik.
   Sensor bisa dicolok belakangan tanpa flash ulang.
3. **Kalibrasi FC-37:**
   - Catat `hujan_ao` saat pelat **kering** (misalnya ±4000).
   - Tetesi pelat dengan air, catat `hujan_ao` saat **basah** (misalnya ±1000).
   - Isi `RAIN_WET_THRESHOLD` di `include/config.h` di antara kedua nilai (mis. tengah-tengahnya),
     lalu flash ulang.

## 6. Pemecahan masalah

| Gejala | Kemungkinan penyebab |
|---|---|
| BMP280 / BH1750 "belum terhubung" | SDA dan SCL tertukar, solder pin longgar, VCC belum 3.3V, alamat I2C salah (SDO / ADDR). |
| Sensor dicabut tapi masih terbaca "terhubung" | Hanya VCC yang dicabut. Chip masih mendapat daya dari CSB (3V3), SDA, atau SCL lewat dioda proteksi dan membalas I2C dengan data beku. Cabut semua kabel sensor untuk menguji. |
| Dua sensor I2C sama-sama gagal | Kabel SDA/SCL putus atau korslet, salah satu modul menahan jalur. Lepas satu sensor lalu uji bergantian. |
| DHT22 selalu NaN / "belum terhubung" | Pull-up 10 kΩ tidak ada, DATA salah pin (harus GPIO 4), kabel terlalu panjang. |
| `hujan_ao` selalu 4095 | AO tidak terhubung, GPIO 25 tidak memberi daya, pelat tidak tersambung ke modul. |
| `hujan_ao` tidak berubah saat dibasahi | Pelat korosi atau kabel pelat longgar. Bersihkan atau ganti pelat. |
| WiFi menyala, nilai AO acak | AO terpasang ke pin ADC2. Pindahkan ke GPIO 34. |
