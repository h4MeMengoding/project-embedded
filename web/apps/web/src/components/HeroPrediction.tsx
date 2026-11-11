import { formatWib } from '@ws/core';
import type { SensorFlags } from '@ws/core';
import type { HomeState } from '../lib/homeState';
import { RingGauge } from './RingGauge';
import { Pill } from './Pill';
import { StationIllustration } from './StationIllustration';

export function HeroPrediction({ state, predictionTs, sensors }: { state: HomeState; predictionTs: Date | null; sensors: SensorFlags | null }) {
  if (state.kind === 'empty') {
    return (
      <div className="hero">
        <div className="empty-card">Data belum tersedia. Hubungkan perangkat atau jalankan seed data.</div>
        <StationIllustration online={false} />
      </div>
    );
  }
  const range = predictionTs
    ? `3 jam ke depan · ${formatWib(predictionTs, 'time')}–${formatWib(new Date(predictionTs.getTime() + 3 * 3600_000), 'time')} WIB`
    : '3 jam ke depan';
  return (
    <div className="hero">
      <div className={`hero-main${state.kind === 'offline' ? ' stale' : ''}`}>
        <RingGauge percent={state.percent} label={state.kind === 'offline' ? 'data tidak terkini' : undefined} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="eyebrow">{range}</div>
          <div>
            <div className="lead">{state.headline}</div>
            {state.verdict && <div className="verdict">{state.verdict}</div>}
          </div>
          <div className="pills">
            {state.agreement && <Pill tone={state.agreementTone === 'bad' ? 'whitebad' : 'white'}>{state.agreement}</Pill>}
            <Pill tone="warn">{state.current}</Pill>
            {state.kind !== 'offline' && <span className="pill-status"><Pill tone="ok">Perangkat online{state.lastSeenTime ? ` · ${state.lastSeenTime} WIB` : ''}</Pill></span>}
            {state.kind === 'offline' && <span className="pill-status"><Pill tone="warn">Perangkat offline{state.lastSeenLabel ? ` · ${state.lastSeenLabel}` : ''}</Pill></span>}
          </div>
        </div>
      </div>
      <StationIllustration online={state.kind !== 'offline'} sensors={sensors} />
    </div>
  );
}
