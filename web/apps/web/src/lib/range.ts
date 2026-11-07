const H = 3600_000;
const PRESETS = { '6h': 6 * H, '24h': 24 * H, '7d': 168 * H } as const;
const MAX = 31 * 24 * H;

export type ResolvedRange = { from: Date; to: Date; preset: '6h' | '24h' | '7d' | 'custom' };

export function resolveRange(params: { range?: string; from?: string; to?: string }, now: Date): ResolvedRange {
  const def: ResolvedRange = { from: new Date(now.getTime() - PRESETS['24h']), to: now, preset: '24h' };
  if (params.from && params.to) {
    const from = new Date(params.from);
    const to = new Date(params.to);
    const ok = !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to && to.getTime() - from.getTime() <= MAX;
    return ok ? { from, to, preset: 'custom' } : def;
  }
  const r = params.range;
  if (r === '6h' || r === '24h' || r === '7d') return { from: new Date(now.getTime() - PRESETS[r]), to: now, preset: r };
  return def;
}
