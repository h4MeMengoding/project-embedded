import { describe, it, expect } from 'vitest';
import { hashToken, verifyToken } from '../src/token';

describe('token perangkat', () => {
  const h = hashToken('rahasia-123');
  it('format scrypt, bukan teks biasa', () => {
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(h).not.toContain('rahasia-123');
  });
  it('token benar lolos', () => expect(verifyToken('rahasia-123', h)).toBe(true));
  it('token salah ditolak', () => expect(verifyToken('rahasia-124', h)).toBe(false));
  it('salt acak', () => expect(hashToken('rahasia-123')).not.toBe(h));
  it('format lain ditolak', () => {
    expect(verifyToken('x', 'seed:abc')).toBe(false);
    expect(verifyToken('x', 'scrypt$zz$')).toBe(false);
    expect(verifyToken('', h)).toBe(false);
  });
});
