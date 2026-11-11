#include "ota.h"
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <Update.h>
#include <esp_task_wdt.h>
#include "config.h"
#include "uploader.h"

static const char* PATH_PREFIX = "/api/device/firmware/";
static const uint32_t STALL_MS = 15000;  // batas tunggu data per baca (HTTPClient)

// Update bukan Stream; adaptor ini membuat HTTPClient::writeToStream (yang mengurai chunked) menulis ke slot OTA.
struct UpdateSink : public Stream {
  size_t write(uint8_t b) override { return Update.write(&b, 1); }
  size_t write(const uint8_t* buf, size_t n) override { return Update.write(const_cast<uint8_t*>(buf), n); }
  int available() override { return 0; }
  int read() override { return -1; }
  int peek() override { return -1; }
};

static bool pending = false;
static String jobPath, jobMd5;
static uint32_t jobSize = 0;

void otaSchedule(const char* path, uint32_t size, const char* md5) {
  bool ok = path && !strncmp(path, PATH_PREFIX, strlen(PATH_PREFIX)) && size > 0 && md5 && strlen(md5) == 32;
  if (!ok) { Serial.println("[ota] perintah ditolak: path/size/md5 tidak valid"); return; }
  if (pending) return;
  jobPath = path; jobSize = size; jobMd5 = md5; pending = true;
  Serial.printf("[ota] perintah diterima: %u byte\n", (unsigned)size);
}

bool otaDue() { return pending; }

static bool download() {
  String url = String(WS_TLS ? "https://" : "http://") + WS_HOST + ":" + WS_PORT + jobPath;
  HTTPClient http;
#if WS_TLS
  NetworkClientSecure client;
  client.setCACert(ROOT_CA);
#else
  NetworkClient client;
#endif
  http.setTimeout(STALL_MS);
  if (!http.begin(client, url)) { Serial.println("[ota] http.begin gagal"); return false; }
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  int code = http.GET();
  if (code != 200) { Serial.printf("[ota] unduh gagal, HTTP %d\n", code); return false; }
  int len = http.getSize();  // -1 = chunked (Next tidak mengirim Content-Length)
  if (len > 0 && (uint32_t)len != jobSize) { Serial.printf("[ota] ukuran %d != %u\n", len, (unsigned)jobSize); return false; }
  if (!Update.begin(jobSize)) { Update.printError(Serial); return false; }
  Update.setMD5(jobMd5.c_str());

  // Hapus flash + unduh bisa >30 dtk: lepas dari watchdog selama OTA (writeToStream juga mengurai chunked).
  esp_task_wdt_delete(NULL);
  UpdateSink sink;
  int written = http.writeToStream(&sink);
  esp_task_wdt_add(NULL);
  if (written != (int)jobSize) {
    Serial.printf("[ota] terunduh %d dari %u byte\n", written, (unsigned)jobSize);
    Update.abort();
    return false;
  }
  if (!Update.end(true)) { Update.printError(Serial); return false; }  // end(true) juga memeriksa MD5
  return true;
}

void otaRun() {
  uploaderPrepareOta();  // simpan antrean RAM ke flash, putus WebSocket (membebaskan RAM TLS)
  Serial.println("[ota] mengunduh firmware…");
  bool ok = download();
  pending = false;
  if (ok) {
    Serial.println("[ota] berhasil, restart");
    delay(500);
    ESP.restart();
  }
  Serial.println("[ota] gagal, tetap memakai firmware lama");
}
