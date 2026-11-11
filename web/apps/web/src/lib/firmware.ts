// Slot app di esp/partitions_ota.csv: 0x180000 byte. Image ESP32 selalu diawali byte ajaib 0xE9.
export const FIRMWARE_MAX_BYTES = 0x180000;
export const VERSION_RE = /^[\w.+-]{1,32}$/;

/** null = image tampak valid; selain itu pesan kesalahan untuk pengguna. */
export function checkFirmwareImage(buf: Buffer): string | null {
  if (buf.length === 0) return 'File kosong.';
  if (buf.length > FIRMWARE_MAX_BYTES) return `File ${buf.length} byte melebihi slot firmware (${FIRMWARE_MAX_BYTES} byte).`;
  if (buf[0] !== 0xe9) return 'Bukan image firmware ESP32. Unggah .pio/build/esp32doit-devkit-v1/firmware.bin.';
  return null;
}

/** Versi dari penanda "FWVER:x.y.z" yang ditanam firmware (esp/src/main.cpp); null jika tidak ada. */
export function extractVersion(buf: Buffer): string | null {
  return /FWVER:([\w.+-]{1,32})\0/.exec(buf.toString('latin1'))?.[1] ?? null;
}
