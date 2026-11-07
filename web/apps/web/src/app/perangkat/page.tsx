import { getBackfillStats, getCompleteness, getDeviceStatus, getLatencyStats, getLatestReading, getOfflineGaps, getSeries } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { DeviceStatusCard } from '@/components/device/DeviceStatusCard';
import { SensorTable } from '@/components/device/SensorTable';
import { CompletenessChart } from '@/components/device/CompletenessChart';
import { LatencyCard } from '@/components/device/LatencyCard';
import { GapList } from '@/components/device/GapList';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perangkat · Stasiun Cuaca' };

export default async function Perangkat() {
  const env = getEnv();
  const db = getDb();
  const now = new Date();
  const from7 = new Date(now.getTime() - 7 * 86400_000);
  const [status, latest, series, completeness, latency, gaps, backfill] = await Promise.all([
    getDeviceStatus(db, env.deviceId, env.offlineAfterSec, now),
    getLatestReading(db, env.deviceId),
    getSeries(db, env.deviceId, new Date(now.getTime() - 24 * 3600_000), now),
    getCompleteness(db, env.deviceId, from7, now),
    getLatencyStats(db, env.deviceId, from7, now),
    getOfflineGaps(db, env.deviceId, from7, now),
    getBackfillStats(db, env.deviceId, from7, now),
  ]);
  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="perangkat" online={status.online} deviceId={env.deviceId} />
          <div style={{ padding: '40px 0 120px' }}><h1 style={{ fontSize: 40, fontWeight: 800 }}>Perangkat</h1></div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          <div className="grid gap-7 lg:grid-cols-2">
            <DeviceStatusCard s={status} deviceId={env.deviceId} />
            <LatencyCard l={latency} backfill={backfill} />
          </div>
          <SensorTable latest={latest} history={series.readings} />
          <CompletenessChart c={completeness} />
          <GapList gaps={gaps} />
        </div>
        <div className="stamp">Semua waktu dalam WIB · 7 hari terakhir</div>
      </PageShell>
    </>
  );
}
