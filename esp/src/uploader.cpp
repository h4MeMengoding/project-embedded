#include "uploader.h"
#include <vector>
#include <LittleFS.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>
#include "config.h"

static const char* PENDING_PATH = "/pending.ndjson";
static const char* OFFSET_PATH = "/pending.off";  // byte yang sudah diterima server
static const size_t FILE_LIMIT = 1024 * 1024;  // 1 MB
static const size_t RAM_MAX = 30;
static const size_t BATCH = 50;
static const uint32_t BACKFILL_GAP_MS = 3000;   // jeda antar batch backfill (server: maks 30 request/menit)
static const uint32_t RETRY_AFTER_FAIL_MS = 30000;

static StatusFiller fillStatus = nullptr;
static std::vector<String> ram;
static uint32_t fileLines = 0;  // baris yang belum terkirim
static size_t sentOffset = 0;
static bool bufferFull = false;
static uint32_t lastBackfillMs = 0, lastFailMs = 0;
static bool hadFail = false;

enum class Result { Ok, Rejected, Failed };

static size_t fileSize() {
  File f = LittleFS.open(PENDING_PATH, "r");
  size_t n = f ? f.size() : 0;
  if (f) f.close();
  return n;
}

// shortcut: ruang yang sudah terkirim baru dibebaskan saat file habis terkirim seluruhnya;
// file tidak ditulis ulang per batch (hemat flash & tidak memblokir loop).
static void appendToFile(const std::vector<String>& recs) {
  size_t size = fileSize();
  File f = LittleFS.open(PENDING_PATH, "a");
  if (!f) { Serial.println("[buffer] gagal membuka file pending"); return; }
  for (const String& r : recs) {
    if (size + r.length() + 1 > FILE_LIMIT) {
      bufferFull = true;
      Serial.println("[buffer] PENUH (1 MB): record baru dibuang");
      break;
    }
    f.print(r);
    f.print('\n');
    size += r.length() + 1;
    fileLines++;
  }
  f.close();
}

static bool validRecord(const String& line) {
  if (!line.endsWith("}")) return false;
  JsonDocument d;
  return !deserializeJson(d, line) && d["type"].is<const char*>() && d["ts"].is<long long>();
}

// Baca maksimal n record valid mulai dari sentOffset. Baris rusak (mis. listrik mati saat menulis) dilewati.
static void readBatch(size_t n, std::vector<String>& out, size_t& endOffset, uint32_t& consumed) {
  endOffset = sentOffset;
  consumed = 0;
  File f = LittleFS.open(PENDING_PATH, "r");
  if (!f) return;
  f.seek(sentOffset);
  while (out.size() < n && f.available()) {
    String line = f.readStringUntil('\n');
    consumed++;
    line.trim();
    if (!line.length()) continue;
    if (validRecord(line)) out.push_back(line);
    else Serial.printf("[buffer] baris rusak dilewati: %.60s\n", line.c_str());
  }
  endOffset = f.position();
  f.close();
}

static void commitOffset(size_t endOffset, uint32_t consumed) {
  sentOffset = endOffset;
  fileLines = consumed > fileLines ? 0 : fileLines - consumed;
  if (sentOffset >= fileSize()) {
    LittleFS.remove(PENDING_PATH);
    LittleFS.remove(OFFSET_PATH);
    sentOffset = 0;
    fileLines = 0;
    bufferFull = false;
    Serial.println("[buffer] semua record tertunda terkirim");
    return;
  }
  File o = LittleFS.open(OFFSET_PATH, "w");
  if (o) { o.print((unsigned long)sentOffset); o.close(); }
}

void uploaderBegin(StatusFiller fill) {
  fillStatus = fill;
  if (!LittleFS.begin(true)) Serial.println("[buffer] LittleFS gagal di-mount");
  size_t size = fileSize();
  File o = LittleFS.open(OFFSET_PATH, "r");
  if (o) { sentOffset = o.readString().toInt(); o.close(); }
  if (sentOffset > size) sentOffset = 0;
  File f = LittleFS.open(PENDING_PATH, "r");
  if (f) {
    if (size > 0) {  // listrik mati di tengah penulisan: tutup baris yatim agar baris berikutnya tidak menempel
      f.seek(size - 1);
      bool needNl = f.read() != '\n';
      f.seek(sentOffset);
      while (f.available()) if (f.read() == '\n') fileLines++;
      f.close();
      if (needNl) { File a = LittleFS.open(PENDING_PATH, "a"); a.print('\n'); a.close(); fileLines++; }
    } else {
      f.close();
    }
  }
  bufferFull = fileSize() >= FILE_LIMIT;
  Serial.printf("[buffer] %u record tertunda di flash\n", (unsigned)fileLines);
}

void uploaderEnqueue(const String& record) {
  if (ram.size() >= RAM_MAX) {
    appendToFile(ram);
    ram.clear();
  }
  ram.push_back(record);
}

static Result post(const std::vector<String>& recs, bool backfill) {
  // Amplop dibuat manual agar record (sudah berupa JSON) tidak diparse ulang.
  JsonDocument head;
  head["device_id"] = DEVICE_ID;
  head["fw"] = FW_VERSION;
  fillStatus(head["status"].to<JsonObject>());
  String body;
  serializeJson(head, body);
  body.remove(body.length() - 1);  // buang '}' penutup
  body += ",\"records\":[";
  for (size_t i = 0; i < recs.size(); i++) {
    if (i) body += ',';
    if (backfill) {
      body += recs[i].substring(0, recs[i].length() - 1);
      body += ",\"backfill\":true}";
    } else {
      body += recs[i];
    }
  }
  body += "]}";

  static WiFiClientSecure tls;
  static WiFiClient plain;
  static bool tlsInit = false;
  HTTPClient http;
  bool https = strncmp(API_URL, "https://", 8) == 0;
  if (https) {
    if (!tlsInit) {
      tls.setCACert(ROOT_CA);
      tls.setHandshakeTimeout(8);  // detik; default 120 dtk akan memicu watchdog 30 dtk
      tlsInit = true;
    }
    http.begin(tls, API_URL);
  } else {
    http.begin(plain, API_URL);
  }
  http.setConnectTimeout(5000);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " DEVICE_TOKEN);
  esp_task_wdt_reset();
  int code = http.POST(body);
  esp_task_wdt_reset();
  String resp = code > 0 ? http.getString() : http.errorToString(code);
  http.end();

  if (code == 200) {
    Serial.printf("[kirim] OK %u record%s %s\n", (unsigned)recs.size(), backfill ? " (backfill)" : "", resp.c_str());
    return Result::Ok;
  }
  Serial.printf("[kirim] GAGAL kode %d: %s\n", code, resp.c_str());
  if (code == 401) Serial.println("[kirim] token ditolak: periksa DEVICE_ID / DEVICE_TOKEN di config.h");
  // 400/413: payload ditolak permanen; dibuang agar antrean tidak macet selamanya.
  if (code == 400 || code == 413) return Result::Rejected;
  return Result::Failed;
}

void uploaderTick(bool minuteDue) {
  uint32_t now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (!ram.empty()) {
      appendToFile(ram);
      ram.clear();
    }
    return;
  }

  if (minuteDue || (!ram.empty() && !hadFail)) {
    Result r = post(ram, false);
    if (r == Result::Failed) {
      appendToFile(ram);
      hadFail = true;
      lastFailMs = now;
    } else {
      if (r == Result::Rejected) Serial.printf("[kirim] %u record dibuang (ditolak server)\n", (unsigned)ram.size());
      hadFail = false;
    }
    ram.clear();
    lastBackfillMs = now;
    return;
  }

  if (fileLines > 0 && now - lastBackfillMs >= BACKFILL_GAP_MS && (!hadFail || now - lastFailMs >= RETRY_AFTER_FAIL_MS)) {
    std::vector<String> batch;
    size_t endOffset;
    uint32_t consumed;
    readBatch(BATCH, batch, endOffset, consumed);
    lastBackfillMs = now;
    if (batch.empty()) { commitOffset(endOffset, consumed); return; }
    Result r = post(batch, true);
    if (r == Result::Failed) {
      hadFail = true;
      lastFailMs = now;
      return;
    }
    hadFail = false;
    commitOffset(endOffset, consumed);
  }
}

uint32_t uploaderBacklog() { return fileLines + ram.size(); }
bool uploaderBufferFull() { return bufferFull; }
