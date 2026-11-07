import { FUZZY_CONFIG_V1 as C } from '@ws/core';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { getDeviceStatus } from '@ws/db';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { MembershipChart } from '@/components/fuzzy/MembershipChart';
import { RuleTable } from '@/components/fuzzy/RuleTable';
import { Calculator } from '@/components/fuzzy/Calculator';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fuzzy · Stasiun Cuaca' };

export default async function FuzzyPage() {
  const env = getEnv();
  const device = await getDeviceStatus(getDb(), env.deviceId, env.offlineAfterSec, new Date());
  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="fuzzy" online={device.online} deviceId={env.deviceId} />
          <div style={{ padding: '40px 0 120px' }}>
            <div className="eyebrow">Metode prediksi</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, marginTop: 8 }}>Fuzzy Mamdani</h1>
            <p style={{ marginTop: 8, opacity: 0.85 }}>Konfigurasi aktif: <b>{C.version}</b>. Parameter hanya boleh diubah sebelum periode evaluasi dimulai.</p>
          </div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          <div className="grid gap-7 lg:grid-cols-2">
            <MembershipChart title="ΔP3h" unit="hPa" universe={C.universe.dp} sets={C.dp} />
            <MembershipChart title="Kelembapan (RH)" unit="%" universe={C.universe.rh} sets={C.rh} />
            <MembershipChart title="DPD (suhu − titik embun)" unit="°C" universe={C.universe.dpd} sets={C.dpd} />
            <MembershipChart title="Peluang hujan (output)" unit="%" universe={[0, 100]} sets={C.out} />
          </div>
          <RuleTable />
          <Calculator />
        </div>
        <div className="stamp">Semua waktu dalam WIB</div>
      </PageShell>
    </>
  );
}
