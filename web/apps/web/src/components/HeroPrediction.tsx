import { formatWib } from '@ws/core';
import type { HomeState } from '../lib/homeState';
import { RingGauge } from './RingGauge';
import { Pill } from './Pill';
import { StationIllustration } from './StationIllustration';

export function HeroPrediction({ state, predictionTs }: { state: HomeState; predictionTs: Date | null }) {
  if (state.kind === 'empty') {
    return (
      <div className="hero">
        <div className="empty-card">Belum ada data. Jalankan seed atau hubungkan perangkat.</div>
        <StationIllustration />
      </div>
    );
  }
  const range = predictionTs
    ? `3 jam ke depan · ${formatWib(predictionTs, 'time')}–${formatWib(new Date(predictionTs.getTime() + 3 * 3600_000), 'time')} WIB`
    : '3 jam ke depan';
  return (
    <div className="hero">
      <div className="hero-main">
        <RingGauge percent={state.percent} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="eyebrow">{range}</div>
          <div className="lead">{state.headline}</div>
          <div className="pills">
            {state.agreement && <Pill tone="white">{state.agreement}</Pill>}
            <Pill tone="warn">{state.current}</Pill>
            {state.kind === 'offline' && <Pill tone="warn">Perangkat offline{state.lastSeenLabel ? ` · ${state.lastSeenLabel}` : ''}</Pill>}
          </div>
        </div>
      </div>
      <StationIllustration />
    </div>
  );
}
