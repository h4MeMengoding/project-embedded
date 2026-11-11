#pragma once
#include <Arduino.h>

// Pin (CLAUDE.md Bagian 3)
constexpr uint8_t PIN_SDA = 21;      // bus I2C 0 (Wire): BMP280, kabel pendek
constexpr uint8_t PIN_SCL = 22;
constexpr uint8_t PIN_LUX_SDA = 32;  // bus I2C 1 (Wire1): BH1750 sendiri, kabel panjang tidak mengganggu BMP280
constexpr uint8_t PIN_LUX_SCL = 33;
constexpr uint32_t LUX_I2C_HZ = 10000;  // clock rendah agar tahan kapasitansi kabel ±5 m
constexpr uint8_t PIN_DHT = 4;
constexpr uint8_t PIN_RAIN_AO = 34;   // wajib ADC1 (ADC2 mati saat WiFi aktif)
constexpr uint8_t PIN_RAIN_PWR = 25;  // FC-37 hanya diberi daya saat dibaca (kurangi korosi)

// Nilai NAN = sensor tidak terhubung / pembacaan gagal.
struct Sample {
  float tDht, hDht, tBmp, pHpa, lux;
  float rainAo;  // NAN = FC-37 tidak terbaca (AO mengambang/terlepas)
  bool wet;
};

struct SensorFlags {
  bool dht22, bmp280, bh1750, rain;
};

void sensorsBegin();
// Coba ulang inisialisasi sensor yang belum terhubung (dipanggil tiap 60 detik).
void sensorsRetry();
Sample sensorsRead();
SensorFlags sensorsFlags();
void sensorsPrint(const Sample& s);
