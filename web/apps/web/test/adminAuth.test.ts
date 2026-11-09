import { describe, it, expect } from 'vitest';
import { isAdmin, isRegionLocked, sessionValue } from '../src/lib/adminAuth';

describe('adminAuth', () => {
  it('sesi cocok dengan password', () => expect(isAdmin(sessionValue('x'), 'x')).toBe(true));
  it('password berganti -> sesi lama tidak berlaku', () => expect(isAdmin(sessionValue('x'), 'y')).toBe(false));
  it('tanpa cookie', () => expect(isAdmin(undefined, 'x')).toBe(false));
  it('password kosong = admin dimatikan', () => {
    expect(isAdmin(sessionValue(''), '')).toBe(false);
    expect(isAdmin(sessionValue(''), undefined)).toBe(false);
  });
  it('cookie bukan hex / panjang beda', () => expect(isAdmin('abc', 'x')).toBe(false));
  it('sesi tidak berisi password', () => expect(sessionValue('rahasia')).not.toContain('rahasia'));
});

describe('isRegionLocked', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  it('tanpa EVAL_START', () => expect(isRegionLocked(null, now)).toBe(false));
  it('sebelum EVAL_START', () => expect(isRegionLocked(new Date('2026-11-21T00:00:00Z'), now)).toBe(false));
  it('tepat/sesudah EVAL_START', () => {
    expect(isRegionLocked(now, now)).toBe(true);
    expect(isRegionLocked(new Date('2026-11-19T00:00:00Z'), now)).toBe(true);
  });
});
