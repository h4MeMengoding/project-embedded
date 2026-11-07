import { formatWib } from '@ws/core';
import { getBmkgSlots, getDeviceStatus, getLatestPrediction, getLatestReading, getRainIntervals, getSeries } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { HomeLive } from '@/components/HomeLive';
import { BmkgCard } from '@/components/BmkgCard';
import { ProbabilityHistoryCard } from '@/components/ProbabilityHistoryCard';
import { RainActivityCard } from '@/components/RainActivityCard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const env = getEnv();
  const db = getDb();
  const now = new Date();
  const slotStart = new Date(Math.floor(now.getTime() / (3 * 3600_000)) * 3 * 3600_000);
  const [reading, prediction, device, slots, series, intervals] = await Promise.all([
    getLatestReading(db, env.deviceId),
    getLatestPrediction(db, env.deviceId),
    getDeviceStatus(db, env.deviceId, env.offlineAfterSec, now),
    getBmkgSlots(db, env.adm4, slotStart, 3),
    getSeries(db, env.deviceId, new Date(now.getTime() - 6 * 3600_000), now),
    getRainIntervals(db, env.deviceId, new Date(now.getTime() - 6 * 86400_000), now),
  ]);
  const points = series.predictions.filter((p) => p.status === 'ok' && p.probability != null).map((p) => ({ t: p.ts.getTime(), p: p.probability as number }));
  const seen = device.lastSeenAt ?? reading?.ts ?? null;

  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="beranda" online={device.online} deviceId={env.deviceId} />
          <HomeLive
            initial={{ reading, prediction, device: { online: device.online, lastSeenAt: device.lastSeenAt } }}
            wsUrl={env.publicWsUrl}
            bmkgNow={slots[0] ? { weatherCode: slots[0].weatherCode, weatherDesc: slots[0].weatherDesc } : null}
            threshold={env.predictThreshold}
          />
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="cards-row">
          <ProbabilityHistoryCard points={points} configVersion={prediction?.configVersion ?? null} />
          <BmkgCard slots={slots} mode={env.slotMode} />
          <RainActivityCard intervals={intervals} now={now} />
        </div>
        <div className="stamp">{seen ? `Data terakhir ${formatWib(seen, 'time')} WIB · ` : ''}Semua waktu dalam WIB</div>
      </PageShell>
    </>
  );
}
