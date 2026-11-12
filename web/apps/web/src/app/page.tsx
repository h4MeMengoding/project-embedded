import { formatWib, slotBounds } from '@ws/core';
import { getActiveAdm4, getMode, getBmkgSlots, getDeviceStatus, getLatestPrediction, getLatestReading, getRainIntervals, getSeries } from '@ws/db';
import { selectCurrentSlots } from '@/lib/currentSlots';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { HomeLive } from '@/components/HomeLive';
import { DevHome } from '@/components/DevHome';
import { BmkgCard } from '@/components/BmkgCard';
import { ProbabilityHistoryCard } from '@/components/ProbabilityHistoryCard';
import { RainActivityCard } from '@/components/RainActivityCard';

export const dynamic = 'force-dynamic';

function slotLabel(utc: Date, mode: 'start' | 'center') {
  const b = slotBounds(utc, mode);
  return `${formatWib(b.start, 'time')}–${formatWib(b.end, 'time')}`;
}

export default async function Home() {
  const env = getEnv();
  const db = getDb();
  const now = new Date();
  if ((await getMode(db)) === 'dev') {
    return (
      <HeroBand>
        <PageShell>
          <NavBar active="beranda" />
          <DevHome />
        </PageShell>
      </HeroBand>
    );
  }
  const adm4 = await getActiveAdm4(db, env.adm4);
  const [reading, prediction, device, allSlots, series, intervals] = await Promise.all([
    getLatestReading(db, env.deviceId),
    getLatestPrediction(db, env.deviceId),
    getDeviceStatus(db, env.deviceId, env.offlineAfterSec, now),
    getBmkgSlots(db, adm4, new Date(now.getTime() - 4 * 3600_000), 6),
    getSeries(db, env.deviceId, new Date(now.getTime() - 6 * 3600_000), now),
    getRainIntervals(db, env.deviceId, new Date(now.getTime() - 7 * 86400_000), now),
  ]);
  const slots = selectCurrentSlots(allSlots, now, env.slotMode, 3);
  const points = series.predictions.filter((p) => p.status === 'ok' && p.probability != null).map((p) => ({ t: p.ts.getTime(), p: p.probability as number }));
  const seen = device.lastSeenAt ?? reading?.ts ?? null;

  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="beranda" />
          <HomeLive
            initial={{ reading, prediction, device: { online: device.online, lastSeenAt: device.lastSeenAt, sensors: device.sensors } }}
            bmkgNow={slots[0] ? { weatherCode: slots[0].weatherCode, weatherDesc: slots[0].weatherDesc, slotLabel: slotLabel(slots[0].utcDatetime, env.slotMode) } : null}
            threshold={env.predictThreshold}
            offlineAfterSec={env.offlineAfterSec}
          />
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="cards-row">
          <ProbabilityHistoryCard points={points} threshold={env.predictThreshold} configVersion={prediction?.configVersion ?? null} />
          <BmkgCard slots={slots} mode={env.slotMode} />
          <RainActivityCard intervals={intervals} now={now} />
        </div>
        <div className="stamp">{seen ? `Data terakhir diterima ${formatWib(seen, 'time')}` : ''}</div>
      </PageShell>
    </>
  );
}
