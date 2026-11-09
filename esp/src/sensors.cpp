#include "sensors.h"
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <BH1750.h>
#include <DHT.h>
#include "config.h"

static Adafruit_BMP280 bmp(&Wire);
static BH1750 bh;
static DHT dht(PIN_DHT, DHT22);
static SensorFlags flags = {false, false, false, true};  // FC-37 analog: tidak bisa dideteksi, dianggap ada
static uint8_t dhtFails = 3;  // DHT22 dianggap terhubung jika ada bacaan valid dalam 3 percobaan terakhir

static bool beginBmp() {
  if (!bmp.begin(0x76) && !bmp.begin(0x77)) return false;
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL, Adafruit_BMP280::SAMPLING_X2, Adafruit_BMP280::SAMPLING_X16,
                  Adafruit_BMP280::FILTER_X16, Adafruit_BMP280::STANDBY_MS_500);
  return true;
}

static bool beginBh() { return bh.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire); }

static const char* st(bool ok) { return ok ? "terhubung" : "belum terhubung"; }

void sensorsBegin() {
  pinMode(PIN_RAIN_PWR, OUTPUT);
  digitalWrite(PIN_RAIN_PWR, LOW);
  analogSetPinAttenuation(PIN_RAIN_AO, ADC_11db);
  Wire.begin(PIN_SDA, PIN_SCL);
  dht.begin();
  flags.bmp280 = beginBmp();
  flags.bh1750 = beginBh();
  Serial.printf("BMP280: %s, BH1750: %s, DHT22: dicek saat pembacaan pertama\n", st(flags.bmp280), st(flags.bh1750));
}

void sensorsRetry() {
  if (!flags.bmp280 && (flags.bmp280 = beginBmp())) Serial.println("BMP280 terdeteksi");
  if (!flags.bh1750 && (flags.bh1750 = beginBh())) Serial.println("BH1750 terdeteksi");
}

static int readRainAo() {
  digitalWrite(PIN_RAIN_PWR, HIGH);
  delay(100);
  long sum = 0;
  for (int i = 0; i < 5; i++) { sum += analogRead(PIN_RAIN_AO); delay(5); }
  digitalWrite(PIN_RAIN_PWR, LOW);
  return sum / 5;
}

Sample sensorsRead() {
  Sample s = {NAN, NAN, NAN, NAN, NAN, 0, false};

  float t = dht.readTemperature(), h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    if (dhtFails < 3) dhtFails++;
  } else {
    dhtFails = 0;
    s.tDht = constrain(t, -40.0f, 80.0f);
    s.hDht = constrain(h, 0.0f, 100.0f);  // DHT22 bisa >100% saat jenuh; server menolak di luar 0..100
  }
  bool dhtOk = dhtFails < 3;
  if (dhtOk != flags.dht22) Serial.printf("DHT22: %s\n", st(dhtOk));
  flags.dht22 = dhtOk;

  if (flags.bmp280) {
    float p = bmp.readPressure() / 100.0f;  // hPa, tekanan stasiun (TIDAK dikoreksi ke permukaan laut)
    float tb = bmp.readTemperature();
    if (isnan(p) || p < 300 || p > 1100) {
      flags.bmp280 = false;  // kabel lepas: coba begin() lagi di sensorsRetry()
      Serial.println("BMP280: pembacaan tidak wajar, dianggap belum terhubung");
    } else {
      s.pHpa = p;
      s.tBmp = constrain(tb, -40.0f, 85.0f);
    }
  }

  if (flags.bh1750) {
    float lx = bh.readLightLevel();
    if (lx < 0) {
      flags.bh1750 = false;
      Serial.println("BH1750: gagal dibaca, dianggap belum terhubung");
    } else {
      s.lux = min(lx, 200000.0f);
    }
  }

  s.rainAo = readRainAo();
  s.wet = s.rainAo < RAIN_WET_THRESHOLD;  // FC-37 bernilai lebih rendah saat basah
  return s;
}

SensorFlags sensorsFlags() { return flags; }

static void pf(const char* name, float v, const char* unit) {
  if (isnan(v)) Serial.printf("%s=belum terhubung  ", name);
  else Serial.printf("%s=%.2f%s  ", name, v, unit);
}

void sensorsPrint(const Sample& s) {
  pf("suhu_dht", s.tDht, "C");
  pf("rh", s.hDht, "%");
  pf("suhu_bmp", s.tBmp, "C");
  pf("tekanan", s.pHpa, "hPa");
  pf("lux", s.lux, "");
  Serial.printf("hujan_ao=%d (ambang %d) %s\n", s.rainAo, RAIN_WET_THRESHOLD, s.wet ? "BASAH" : "KERING");
}
