import { describe, expect, it } from 'vitest';
import { checkFirmwareImage, extractVersion, FIRMWARE_MAX_BYTES } from '../src/lib/firmware';

describe('checkFirmwareImage', () => {
  it('menerima image berbyte ajaib 0xE9', () => expect(checkFirmwareImage(Buffer.from([0xe9, 1, 2]))).toBeNull());
  it('menolak kosong, bukan image, dan terlalu besar', () => {
    expect(checkFirmwareImage(Buffer.alloc(0))).toMatch(/kosong/);
    expect(checkFirmwareImage(Buffer.from('hello'))).toMatch(/Bukan image/);
    const big = Buffer.alloc(FIRMWARE_MAX_BYTES + 1); big[0] = 0xe9;
    expect(checkFirmwareImage(big)).toMatch(/melebihi/);
  });
});

describe('extractVersion', () => {
  it('membaca FWVER dari dalam binary', () => expect(extractVersion(Buffer.from('xx\0FWVER:1.0.7\0yy', 'latin1'))).toBe('1.0.7'));
  it('null jika tidak ada penanda', () => expect(extractVersion(Buffer.from('tanpa penanda'))).toBeNull());
});
