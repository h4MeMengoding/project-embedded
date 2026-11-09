#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

// Pengirim record persisten (minute, rain_event) ke POST API_URL dengan store-and-forward LittleFS.
// HTTP 200 = semua record di request tersimpan di server (server idempoten), jadi tidak perlu seq/ACK.

using StatusFiller = void (*)(JsonObject status);

void uploaderBegin(StatusFiller fill);
// Record JSON satu objek (tanpa newline). Masuk antrean RAM; jika penuh langsung ke file.
void uploaderEnqueue(const String& record);
// Panggil di loop. minuteDue=true sekali per menit: kirim antrean RAM (atau status saja sebagai heartbeat).
void uploaderTick(bool minuteDue);
uint32_t uploaderBacklog();
bool uploaderBufferFull();
