import { formatWib } from '@ws/core';
import { getEvaluation } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { RangePicker } from '@/components/history/RangePicker';
import { SlotTable } from '@/components/evaluation/SlotTable';
import { ConfusionMatrix } from '@/components/evaluation/ConfusionMatrix';
import { MetricsTable } from '@/components/evaluation/MetricsTable';
import { Assumptions } from '@/components/evaluation/Assumptions';
import { DownloadMenu } from '@/components/DownloadMenu';
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
  const ev = await getEvaluation(db, env.deviceId, from, to, now, { start: env.calibStart, end: env.calibEnd });
  const hasFrom = Boolean(sp.from || env.evalStart);
  const hasTo = Boolean(sp.to || env.evalEnd);
  const summary = hasFrom || hasTo
    ? `${hasFrom ? formatWib(from, 'datetime') : 'awal data'} – ${hasTo ? formatWib(to, 'datetime') : 'sekarang'}`
    : 'Semua data';
  const q = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="evaluasi" />
          <div style={{ padding: '40px 0 120px', display: 'grid', gap: 24 }}>
            <div className="page-head">
              <div>
                <h1>Evaluasi</h1>
                <p>Perbandingan kinerja prediksi hujan 3 jam ke depan antara fuzzy Mamdani dan prakiraan BMKG, dengan sensor hujan sebagai acuan kejadian aktual. Sumber: BMKG</p>
              </div>
              <div className="page-actions">
                <RecomputeButton />
                <DownloadMenu query={q} items={[{ kind: 'evaluation', label: 'Evaluasi per slot' }]} />
              </div>
            </div>
            <RangePicker
              preset="custom"
              basePath="/evaluasi"
              showPresets={false}
              from={hasFrom ? from.toISOString() : undefined}
              to={hasTo ? to.toISOString() : undefined}
              summary={summary}
              resetHref={sp.from || sp.to ? '/evaluasi' : undefined}
              resetLabel={env.evalStart || env.evalEnd ? 'Kembali ke periode evaluasi' : 'Tampilkan semua data'}
            />
          </div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
            <ConfusionMatrix title="Fuzzy Mamdani" cm={ev.fuzzy.cm} />
            <ConfusionMatrix title="BMKG (Sumber: BMKG)" cm={ev.bmkg.cm} />
          </div>
          <MetricsTable fuzzy={ev.fuzzy.metrics} bmkg={ev.bmkg.metrics} excluded={ev.excluded} />
          <SlotTable slots={ev.slots} />
          <Assumptions minWet={env.rainMinWetMinutes} threshold={env.predictThreshold} slotMode={env.slotMode} />
        </div>
        <div className="stamp" />
      </PageShell>
    </>
  );
}
