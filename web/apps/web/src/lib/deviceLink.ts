// Jembatan route handler Next → koneksi /ws/device. Route handler dibundel terpisah dari server.ts,
// jadi fungsi dipasang di globalThis oleh wsServer (pola yang sama dengan liveHub).
type Send = (deviceId: string, msg: unknown) => boolean;
const g = globalThis as unknown as { __wsSendToDevice?: Send };

export const setDeviceSender = (fn: Send | undefined) => { g.__wsSendToDevice = fn; };

/** Kirim pesan JSON ke perangkat yang sedang tersambung. false = perangkat tidak tersambung. */
export const sendToDevice: Send = (id, msg) => g.__wsSendToDevice?.(id, msg) ?? false;
