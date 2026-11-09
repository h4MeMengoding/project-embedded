import { describe, it, expect, vi, afterEach } from 'vitest';
import { lastLive, publish, publishLive, subscribe, type LiveEvent } from '../src/lib/liveHub';

const live = (deviceId = 'a'): LiveEvent & { type: 'live' } => ({
  type: 'live', deviceId, lastSeenAt: '2026-11-09T15:00:00.000Z',
  sensors: { dht22: false, bmp280: true, bh1750: false, rain: true }, reading: null,
});

describe('liveHub', () => {
  afterEach(() => vi.useRealTimers());

  it('meneruskan event ke pelanggan dan berhenti setelah unsubscribe', () => {
    const got: LiveEvent[] = [];
    const off = subscribe((e) => got.push(e));
    publish({ type: 'minute', deviceId: 'a' });
    off();
    publish({ type: 'minute', deviceId: 'a' });
    expect(got).toEqual([{ type: 'minute', deviceId: 'a' }]);
  });

  it('menyimpan live terakhir per perangkat', () => {
    publishLive(live('b'), 30);
    expect(lastLive('b')?.sensors.bmp280).toBe(true);
    expect(lastLive('zzz')).toBeNull();
  });

  it('offline dikirim jika tidak ada heartbeat selama offlineAfterSec', () => {
    vi.useFakeTimers();
    const got: string[] = [];
    const off = subscribe((e) => got.push(e.type));
    publishLive(live('c'), 30);
    vi.advanceTimersByTime(20_000);
    publishLive(live('c'), 30); // heartbeat baru menunda offline
    vi.advanceTimersByTime(29_000);
    expect(got).toEqual(['live', 'live']);
    vi.advanceTimersByTime(2_000);
    expect(got).toEqual(['live', 'live', 'offline']);
    off();
  });

  it('pelanggan yang melempar tidak mengganggu pelanggan lain', () => {
    const got: string[] = [];
    const a = subscribe(() => { throw new Error('x'); });
    const b = subscribe((e) => got.push(e.type));
    publish({ type: 'minute', deviceId: 'a' });
    a(); b();
    expect(got).toEqual(['minute']);
  });
});
