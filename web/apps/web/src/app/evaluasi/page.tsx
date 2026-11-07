import { getDeviceStatus, getEvaluation } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { RangePicker } from '@/components/history/RangePicker';
import { SlotTable } from '@/components/evaluation/SlotTable';
import { ConfusionMatrix } from '@/components/evaluation/ConfusionMatrix';
import { MetricsTable } from '@/components/evaluation/MetricsTable';
import { Assumptions } from '@/components/evaluation/Assumptions';
import { RecomputeButton } from '@/components/evaluation/RecomputeButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Evaluasi · Stasiun Cuaca' };

function pick(sp: Record<string, string | undefined>, key: string, fallback: Date): Date {
  const d = sp[key] ? new Date(sp[key]!) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
}

export default async function Evaluasi({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const env = getEnv();
  const db = getDb();
  const now = new Date();
  // default: EVAL_START–EVAL_END; kosong -> seluruh jendela data
  const from = pick(sp, 'from', env.evalStart ?? new Date(0));
  const to = pick(sp, 'to', env.evalEnd ?? now);
  const [ev, device] = await Promise.all([
    getEvaluation(db, env.deviceId, from, to),
    getDeviceStatus(db, env.deviceId, env.offlineAfterSec, now),
  ]);
  const q = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="evaluasi" online={device.online} deviceId={env.deviceId} />
          <div style={{ padding: '40px 0 120px', display: 'grid', gap: 20 }}>
            <h1 style={{ fontSize: 40, fontWeight: 800 }}>Evaluasi</h1>
            <p style={{ opacity: 0.85 }}>Prediksi hujan 3 jam: fuzzy Mamdani vs prakiraan BMKG, dibandingkan dengan sensor hujan. Sumber: BMKG</p>
            <RangePicker preset="custom" basePath="/evaluasi" showPresets={false} />
          </div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          <div className="grid gap-7 lg:grid-cols-2">
            <ConfusionMatrix title="Fuzzy Mamdani" cm={ev.fuzzy.cm} />
            <ConfusionMatrix title="BMKG (Sumber: BMKG)" cm={ev.bmkg.cm} />
          </div>
          <MetricsTable fuzzy={ev.fuzzy.metrics} bmkg={ev.bmkg.metrics} />
          <SlotTable slots={ev.slots} />
          <Assumptions minWet={env.rainMinWetMinutes} threshold={env.predictThreshold} slotMode={env.slotMode} />
          <div className="flex flex-wrap items-center gap-4">
            <RecomputeButton />
            <a className="rounded-full px-5 py-3 font-bold bg-[var(--ink)] text-[var(--page)]" href={`/api/export/evaluation?${q}`}>Unduh CSV</a>
          </div>
        </div>
        <div className="stamp">Semua waktu dalam WIB</div>
      </PageShell>
    </>
  );
}
