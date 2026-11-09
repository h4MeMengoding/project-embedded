import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Hash token perangkat: `scrypt$<saltHex>$<hashHex>` (setara bcrypt/argon2, tanpa dependensi). */
export function hashToken(token: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(token, salt, 32).toString('hex')}`;
}

export function verifyToken(token: string, stored: string): boolean {
  const [kind, saltHex, hashHex] = stored.split('$');
  if (kind !== 'scrypt' || !token || !/^[0-9a-f]{32}$/.test(saltHex ?? '') || !/^[0-9a-f]{64}$/.test(hashHex ?? '')) return false;
  return timingSafeEqual(scryptSync(token, Buffer.from(saltHex, 'hex'), 32), Buffer.from(hashHex, 'hex'));
}
