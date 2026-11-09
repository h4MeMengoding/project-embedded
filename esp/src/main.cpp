// Stasiun cuaca ESP32: baca sensor tiap 10 detik, agregat per menit, kirim lewat WebSocket (WSS).
// Spesifikasi: CLAUDE.md Bagian 4 dan web/docs/superpowers/specs/2026-11-09-esp-ingest-bmkg-design.md.
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <esp_sntp.h>
#include <time.h>
#include "config.h"
#include "sensors.h"
#include "uploader.h"

static const time_t TIME_VALID_FROM = 1735689600;  // 2025-01-01 UTC; sebelum ini jam belum tersinkron
static const uint32_t SAMPLE_MS = 10000;

[[maybe_unused]] static bool timeValid() { return time(nullptr) >= TIME_VALID_FROM; }

// ---------- Watchdog 30 detik ----------
[[maybe_unused]] static void setupWatchdog() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t c = {.timeout_ms = 30000, .idle_core_mask = 1, .trigger_panic = true};
  if (esp_task_wdt_reconfigure(&c) != ESP_OK) esp_task_wdt_init(&c);
#else
  esp_task_wdt_init(30, true);
#endif
  esp_task_wdt_add(NULL);
}

#if TEST_MODE
// ---------- TEST_MODE: uji wiring & kalibrasi FC-37, tanpa WiFi ----------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== TEST_MODE: cetak sensor tiap 2 detik, tanpa WiFi ===");
  sensorsBegin();
}

void loop() {
  static uint32_t lastRetry = 0;
  if (millis() - lastRetry >= 10000) { lastRetry = millis(); sensorsRetry(); }
  Sample s = sensorsRead();
  SensorFlags f = sensorsFlags();
  Serial.printf("[%s %s %s %s] ", f.dht22 ? "DHT22" : "dht22?", f.bmp280 ? "BMP280" : "bmp280?",
                f.bh1750 ? "BH1750" : "bh1750?", f.rain ? "FC-37" : "fc37?");
  sensorsPrint(s);
  delay(2000);
}

#else
// ---------- Mode normal ----------

// Agregat satu menit (hanya sampel valid per field).
struct Acc {
  long minute = -1;  // menit UTC (epoch/60) yang sedang dikumpulkan
  double sum[6] = {0};
  int n[6] = {0};
  int wet = 0, samples = 0;
};
static Acc acc;
static bool rainState = false;  // status hujan setelah debounce
static uint8_t rainStreak = 0;

static void addField(int i, float v) {
  if (!isnan(v)) { acc.sum[i] += v; acc.n[i]++; }
}

static void putAvg(JsonDocument& d, const char* k, int i, int decimals) {
  if (acc.n[i] == 0) { d[k] = nullptr; return; }
  double p = pow(10, decimals);
  d[k] = round(acc.sum[i] / acc.n[i] * p) / p;
}

static void finalizeMinute() {
  JsonDocument d;
  d["type"] = "minute";
  d["ts"] = (long long)acc.minute * 60;
  putAvg(d, "temp_dht", 0, 2);
  putAvg(d, "hum_dht", 1, 2);
  putAvg(d, "temp_bmp", 2, 2);
  putAvg(d, "pressure_hpa", 3, 2);
  putAvg(d, "lux", 4, 1);
  putAvg(d, "rain_analog_avg", 5, 0);
  d["rain_wet_seconds"] = min(acc.wet * 10, 60);
  d["samples"] = min(acc.samples, 6);
  String s;
  serializeJson(d, s);
  Serial.printf("[menit] %s\n", s.c_str());
  uploaderEnqueue(s);
}

static void rainEvent(bool wet, time_t ts) {
  JsonDocument d;
  d["type"] = "rain_event";
  d["ts"] = (long long)ts;
  d["state"] = wet ? "start" : "stop";
  String s;
  serializeJson(d, s);
  Serial.printf("[hujan] %s\n", s.c_str());
  uploaderEnqueue(s);
}

// Proses satu sampel. Mengembalikan true jika menit sebelumnya baru saja ditutup.
static bool handleSample(const Sample& s) {
  bool valid = timeValid();
  time_t now = time(nullptr);

  // Debounce: status berubah hanya jika 3 sampel berturut-turut (30 detik) konsisten.
  rainStreak = (s.wet != rainState) ? rainStreak + 1 : 0;
  if (rainStreak >= 3) {
    rainState = s.wet;
    rainStreak = 0;
    if (valid) rainEvent(rainState, now);
  }

  if (!valid) { acc = Acc(); return false; }  // tanpa waktu valid: tidak membuat record
  long m = now / 60;
  bool closed = false;
  if (acc.minute != -1 && m != acc.minute) {
    finalizeMinute();
    closed = true;
  }
  if (m != acc.minute) { acc = Acc(); acc.minute = m; }
  addField(0, s.tDht);
  addField(1, s.hDht);
  addField(2, s.tBmp);
  addField(3, s.pHpa);
  addField(4, s.lux);
  addField(5, s.rainAo);
  if (s.wet) acc.wet++;
  acc.samples++;
  return closed;
}

static Sample lastSample;
static bool haveSample = false;

static void putNum(JsonObject o, const char* k, float v, int decimals) {
  if (isnan(v)) o[k] = nullptr;
  else { double p = pow(10, decimals); o[k] = round(v * p) / p; }
}

static void fillStatus(JsonObject root) {
  JsonObject st = root["status"].to<JsonObject>();
  if (timeValid()) st["ts"] = (long long)time(nullptr);
  else st["ts"] = nullptr;
  st["rssi"] = WiFi.RSSI();
  st["uptime_s"] = millis() / 1000;
  st["heap_free"] = ESP.getFreeHeap();
  st["backlog"] = uploaderBacklog();
  st["buffer_full"] = uploaderBufferFull();
  st["time_valid"] = timeValid();
  SensorFlags f = sensorsFlags();
  JsonObject sn = st["sensors"].to<JsonObject>();
  sn["dht22"] = f.dht22;
  sn["bmp280"] = f.bmp280;
  sn["bh1750"] = f.bh1750;
  sn["rain"] = f.rain;
  if (!haveSample) return;
  JsonObject lv = root["live"].to<JsonObject>();
  if (timeValid()) lv["ts"] = (long long)time(nullptr);
  else lv["ts"] = nullptr;
  putNum(lv, "temp_dht", lastSample.tDht, 2);
  putNum(lv, "hum_dht", lastSample.hDht, 2);
  putNum(lv, "temp_bmp", lastSample.tBmp, 2);
  putNum(lv, "pressure_hpa", lastSample.pHpa, 2);
  putNum(lv, "lux", lastSample.lux, 1);
  lv["rain_analog"] = lastSample.rainAo;
  lv["rain_wet"] = lastSample.wet;
}

// WiFi reconnect dengan backoff 5 → 60 detik.
static void maintainWifi() {
  static uint32_t lastTry = 0, backoff = 5000;
  static bool wasUp = false;
  bool up = WiFi.status() == WL_CONNECTED;
  if (up != wasUp) {
    if (up) Serial.printf("[wifi] tersambung, IP %s, RSSI %d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    else Serial.println("[wifi] terputus");
    wasUp = up;
    backoff = 5000;
    lastTry = millis();
  }
  if (up || millis() - lastTry < backoff) return;
  Serial.printf("[wifi] mencoba sambung ulang (jeda %lu dtk)\n", (unsigned long)(backoff / 1000));
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  lastTry = millis();
  backoff = min<uint32_t>(backoff * 2, 60000);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.printf("\n=== Stasiun cuaca %s, firmware %s ===\n", DEVICE_ID, FW_VERSION);
  setupWatchdog();
  sensorsBegin();
  uploaderBegin(fillStatus);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  // NTP saat boot lalu tiap 6 jam; waktu disimpan UTC.
  sntp_set_sync_interval(6UL * 3600 * 1000);
  configTime(0, 0, "pool.ntp.org", "id.pool.ntp.org");
}

void loop() {
  esp_task_wdt_reset();
  maintainWifi();

  static uint32_t lastSampleMs = 0, lastRetryMs = 0;
  static long lastSlot = -1;
  static bool wasValid = false;

  // Sampel tiap 10 detik: selaras jam (detik 0,10,..,50) saat waktu valid, agar tepat 6 sampel/menit.
  bool valid = timeValid();
  if (valid != wasValid) {
    Serial.println(valid ? "[waktu] tersinkron NTP" : "[waktu] belum valid: record tidak dibuat");
    wasValid = valid;
  }
  bool due = valid ? (time(nullptr) / 10 != lastSlot) : (millis() - lastSampleMs >= SAMPLE_MS);
  bool sendNow = false;
  if (due) {
    lastSlot = time(nullptr) / 10;
    lastSampleMs = millis();
    Sample s = sensorsRead();
    sensorsPrint(s);
    lastSample = s;
    haveSample = true;
    handleSample(s);
    sendNow = true;  // heartbeat tiap sampel: status + live + record baru
  }
  if (millis() - lastRetryMs >= 60000) {
    lastRetryMs = millis();
    sensorsRetry();
  }
  uploaderTick(sendNow);
  delay(50);
}
#endif
