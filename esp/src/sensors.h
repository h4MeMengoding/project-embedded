#pragma once
#include <Arduino.h>

// Pin (CLAUDE.md Bagian 3)
constexpr uint8_t PIN_SDA = 21;
constexpr uint8_t PIN_SCL = 22;
constexpr uint8_t PIN_DHT = 4;
constexpr uint8_t PIN_RAIN_AO = 34;   // wajib ADC1 (ADC2 mati saat WiFi aktif)
constexpr uint8_t PIN_RAIN_PWR = 25;  // FC-37 hanya diberi daya saat dibaca (kurangi korosi)

// Nilai NAN = sensor tidak terhubung / pembacaan gagal.
struct Sample {
  float tDht, hDht, tBmp, pHpa, lux;
  int rainAo;
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
