#pragma once
#include <Arduino.h>

// OTA tarik dari web: server mengirim {"type":"ota","path","size","md5"} lewat WebSocket, ESP32 mengunduh
// firmware dari https://WS_HOST:WS_PORT<path> (header X-Device-Id + Authorization: Bearer token), lalu restart.
// ESP32 tidak membuka port apa pun.

// Dipanggil dari penangan WebSocket: hanya mencatat perintah (unduhan dijalankan otaRun di loop utama).
void otaSchedule(const char* path, uint32_t size, const char* md5);
bool otaDue();
// Memblokir ±10-30 detik. Berhasil: restart. Gagal: kembali (firmware lama tetap jalan, WebSocket tersambung ulang).
void otaRun();
