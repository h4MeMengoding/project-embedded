import { describe, it, expect } from 'vitest';
import { getEnv } from '../src/lib/env';

const base = { DATABASE_URL: 'x', DEVICE_ID: 'stasiun-01' };

describe('getEnv', () => {
  it('empty BMKG_ADM4 -> SEED, defaults', () => {
    const e = getEnv({ ...base });
    expect(e.adm4).toBe('SEED');
    expect(e.predictThreshold).toBe(50);
    expect(e.rainMinWetMinutes).toBe(10);
    expect(e.offlineAfterSec).toBe(30);
    expect(e.slotMode).toBe('start');
    expect(e.evalStart).toBeNull();
  });
  it('threshold override', () => expect(getEnv({ ...base, PREDICT_THRESHOLD: '60' }).predictThreshold).toBe(60));
  it('bad slot mode names variable', () =>
    expect(() => getEnv({ ...base, BMKG_SLOT_MODE: 'abc' })).toThrow(/BMKG_SLOT_MODE/));
  it('bad EVAL_START throws', () =>
    expect(() => getEnv({ ...base, EVAL_START: 'bukan-tanggal' })).toThrow(/EVAL_START/));
  it('valid EVAL_START parses', () =>
    expect(getEnv({ ...base, EVAL_START: '2026-11-20T00:00:00+07:00' }).evalStart?.toISOString()).toBe('2026-11-19T17:00:00.000Z'));
});
