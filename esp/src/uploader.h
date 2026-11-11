#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

// Pengirim record persisten (minute, rain_event) lewat WebSocket ke wss://WS_HOST/WS_PATH dengan store-and-forward LittleFS.
// Setiap batch record membawa `id`; server membalas ack setelah tersimpan (idempoten, kirim ulang aman).
// Tanpa ack (putus / timeout), batch dikembalikan ke file dan dikirim ulang sebagai backfill.

// Mengisi objek akar payload dengan "status" dan "live" (sampel 10 detik terakhir).
using StatusFiller = void (*)(JsonObject root);

void uploaderBegin(StatusFiller fill);
// Record JSON satu objek (tanpa newline). Masuk antrean RAM; jika penuh langsung ke file.
void uploaderEnqueue(const String& record);
// Panggil di loop (menjalankan klien WebSocket). sendNow=true tiap 1 dtk: status + live + antrean RAM (record dikirim segera, tidak menunggu sendNow).
void uploaderTick(bool sendNow);
uint32_t uploaderBacklog();
bool uploaderBufferFull();
// Sebelum OTA: antrean RAM ke flash, putus WebSocket (tersambung ulang otomatis di loop berikutnya).
void uploaderPrepareOta();
