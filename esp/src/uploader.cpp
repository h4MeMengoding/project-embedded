#include "uploader.h"
#include <vector>
#include <LittleFS.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <esp_task_wdt.h>
#include "config.h"
#include "ota.h"
#include "version.h"

static const char* PENDING_PATH = "/pending.ndjson";
static const char* OFFSET_PATH = "/pending.off";  // byte yang sudah diterima server
static const size_t FILE_LIMIT = 768 * 1024;  // 768 KB (partisi LittleFS ±960 KB, lihat partitions_ota.csv)
static const size_t RAM_MAX = 30;
static const size_t BATCH = 50;
static const uint32_t BACKFILL_GAP_MS = 1000;   // jeda antar batch backfill (server: maks 120 pesan/menit)
static const uint32_t ACK_TIMEOUT_MS = 10000;   // tanpa ack: anggap koneksi mati, sambung ulang
static const uint32_t HOLD_AFTER_NACK_MS = 10000;

static StatusFiller fillStatus = nullptr;
static void uploaderConnect();
static std::vector<String> ram;
static uint32_t fileLines = 0;  // baris yang belum terkirim
static size_t sentOffset = 0;
static bool bufferFull = false;
static uint32_t lastBackfillMs = 0, holdUntilMs = 0;

// Satu batch record yang menunggu ack dari server (maks satu; ack berurutan).
struct Inflight {
  bool active = false, fromFile = false;
  uint32_t id = 0, sentMs = 0;
  std::vector<String> recs;
  size_t endOffset = 0;
  uint32_t consumed = 0;
};
static Inflight inflight;
static WebSocketsClient ws;
static bool authed = false;
static uint32_t msgId = 0;

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
      Serial.println("[buffer] PENUH (768 KB): record baru dibuang");
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
  uploaderConnect();
}

void uploaderEnqueue(const String& record) {
  if (ram.size() >= RAM_MAX) {
    appendToFile(ram);
    ram.clear();
  }
  ram.push_back(record);
}

// Putus / gagal / timeout: batch RAM yang belum di-ack dipindah ke file; batch file tetap di file (offset belum maju).
// Server idempoten, jadi kirim ulang aman walau ack-nya yang hilang.
static void failInflight() {
  if (inflight.active && !inflight.fromFile) appendToFile(inflight.recs);
  inflight = Inflight();
}

// Ack, atau nack permanen (payload dibuang agar antrean tidak macet).
static void finishInflight() {
  if (inflight.fromFile) commitOffset(inflight.endOffset, inflight.consumed);
  inflight = Inflight();
  lastBackfillMs = millis();
}

static void handleText(uint8_t* payload, size_t length) {
  JsonDocument d;
  if (deserializeJson(d, payload, length)) return;
  const char* type = d["type"] | "";
  if (!strcmp(type, "hello_ack")) {
    authed = true;
    Serial.println("[ws] terautentikasi");
  } else if (!strcmp(type, "ack")) {
    if (inflight.active && d["id"].as<uint32_t>() == inflight.id) {
      Serial.printf("[kirim] OK %u record%s (disimpan %d, duplikat %d)\n", (unsigned)inflight.recs.size(),
                    inflight.fromFile ? " (backfill)" : "", d["stored"].as<int>(), d["duplicates"].as<int>());
      finishInflight();
    }
  } else if (!strcmp(type, "nack")) {
    if (inflight.active && d["id"].as<uint32_t>() == inflight.id) {
      Serial.printf("[kirim] DITOLAK server: %s\n", d["error"] | "?");
      if (d["permanent"] | false) {
        Serial.printf("[kirim] %u record dibuang\n", (unsigned)inflight.recs.size());
        finishInflight();
      } else {
        failInflight();
        holdUntilMs = millis() + HOLD_AFTER_NACK_MS;
      }
    }
  } else if (!strcmp(type, "ota")) {
    otaSchedule(d["path"] | "", d["size"] | 0, d["md5"] | "");
  } else if (!strcmp(type, "error")) {
    Serial.printf("[ws] server: %s (periksa DEVICE_ID / DEVICE_TOKEN di config.h)\n", d["error"] | "?");
  }
}

static void onEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      Serial.println("[ws] tersambung, kirim hello");
      JsonDocument d;
      d["type"] = "hello";
      d["device_id"] = DEVICE_ID;
      d["token"] = DEVICE_TOKEN;
      String s;
      serializeJson(d, s);
      ws.sendTXT(s);
      break;
    }
    case WStype_DISCONNECTED:  // juga dipanggil tiap percobaan sambung yang gagal
      if (authed) Serial.println("[ws] terputus");
      authed = false;
      failInflight();
      break;
    case WStype_TEXT: handleText(payload, length); break;
    case WStype_ERROR: Serial.println("[ws] error"); break;
    default: break;
  }
}

// Pesan data: status + live + record (kosong = heartbeat). `id` hanya jika ada record: server membalas ack/nack.
static String buildMessage(const std::vector<String>& recs, bool backfill, uint32_t id) {
  // Amplop dibuat manual agar record (sudah berupa JSON) tidak diparse ulang.
  JsonDocument head;
  head["device_id"] = DEVICE_ID;
  head["fw"] = FW_VERSION;
  if (!recs.empty()) head["id"] = id;
  fillStatus(head.as<JsonObject>());
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
  return body;
}

static bool sendText(String& body) {
  esp_task_wdt_reset();
  bool ok = ws.sendTXT(body);
  esp_task_wdt_reset();
  return ok;
}

static void sendBatch(std::vector<String>&& recs, bool fromFile, size_t endOffset, uint32_t consumed) {
  inflight.active = true;
  inflight.fromFile = fromFile;
  inflight.id = ++msgId;
  inflight.sentMs = millis();
  inflight.recs = std::move(recs);
  inflight.endOffset = endOffset;
  inflight.consumed = consumed;
  String body = buildMessage(inflight.recs, fromFile, inflight.id);
  if (!sendText(body)) failInflight();
}

void uploaderTick(bool sendNow) {
  uint32_t now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    esp_task_wdt_reset();
    ws.loop();  // sambung/sambung ulang (TLS handshake memblokir beberapa detik), terima ack
    esp_task_wdt_reset();
  }
  if (inflight.active && now - inflight.sentMs > ACK_TIMEOUT_MS) {
    Serial.println("[kirim] ack tidak datang, sambung ulang");
    failInflight();
    authed = false;
    ws.disconnect();
  }

  // Belum bisa kirim: record RAM langsung ke file agar selamat dari mati listrik.
  if (WiFi.status() != WL_CONNECTED || !authed) {
    if (!ram.empty()) {
      appendToFile(ram);
      ram.clear();
    }
    return;
  }

  bool carried = false;  // pesan data sudah membawa status + live
  if (!inflight.active && (int32_t)(now - holdUntilMs) >= 0) {
    if (!ram.empty()) {
      sendBatch(std::move(ram), false, 0, 0);
      ram.clear();
      carried = true;
    } else if (fileLines > 0 && now - lastBackfillMs >= BACKFILL_GAP_MS) {
      std::vector<String> batch;
      size_t endOffset;
      uint32_t consumed;
      readBatch(BATCH, batch, endOffset, consumed);
      lastBackfillMs = now;
      if (batch.empty()) commitOffset(endOffset, consumed);
      else {
        sendBatch(std::move(batch), true, endOffset, consumed);
        carried = true;
      }
    }
  }
  if (sendNow && !carried) {
    String body = buildMessage({}, false, 0);
    sendText(body);
  }
}

static void uploaderConnect() {
#if WS_TLS
  ws.beginSslWithCA(WS_HOST, WS_PORT, WS_PATH, ROOT_CA);
#else
  ws.begin(WS_HOST, WS_PORT, WS_PATH);
#endif
  ws.onEvent(onEvent);
  ws.setReconnectInterval(5000);
  ws.enableHeartbeat(15000, 3000, 2);  // ping tiap 15 dtk; 2 pong terlewat = putus
}

void uploaderPrepareOta() {
  failInflight();
  if (!ram.empty()) { appendToFile(ram); ram.clear(); }
  authed = false;
  ws.disconnect();
}

uint32_t uploaderBacklog() { return fileLines + ram.size() + (inflight.active && !inflight.fromFile ? inflight.recs.size() : 0); }
bool uploaderBufferFull() { return bufferFull; }
