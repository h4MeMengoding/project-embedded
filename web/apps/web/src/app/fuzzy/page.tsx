import { ACTIVE_FUZZY_CONFIG as C } from '@ws/core';
import { getEnv } from '@/lib/env';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { MembershipChart } from '@/components/fuzzy/MembershipChart';
import { RuleTable } from '@/components/fuzzy/RuleTable';
import { Calculator } from '@/components/fuzzy/Calculator';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fuzzy · Stasiun Cuaca' };

export default function FuzzyPage() {
  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="fuzzy" />
          <div style={{ padding: '40px 0 120px' }}>
            <div className="eyebrow">Metode prediksi</div>
            <div className="page-head" style={{ marginTop: 8 }}>
              <div>
                <h1>Fuzzy Mamdani</h1>
                <p>Sistem inferensi fuzzy Mamdani untuk memperkirakan peluang hujan 3 jam ke depan dari tiga variabel masukan: perubahan tekanan (ΔP3h), kelembapan relatif (RH), dan selisih suhu terhadap titik embun (DPD). {C.pressureTide && `Nilai ΔP3h telah dikoreksi terhadap variasi harian tekanan (amplitudo ${C.pressureTide.amplitudeHpa.toString().replace('.', ',')} hPa, puncak pukul ${C.pressureTide.peakHourWib}.00 dan ${C.pressureTide.peakHourWib + 12}.00). Prediksi hujan ditetapkan bila peluang (satu desimal) melebihi ambang.`}</p>
              </div>
            </div>
          </div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
            <MembershipChart title="ΔP3h terkoreksi" unit="hPa" universe={C.universe.dp} sets={C.dp} />
            <MembershipChart title="Kelembapan (RH)" unit="%" universe={C.universe.rh} sets={C.rh} />
            <MembershipChart title="DPD (suhu − titik embun)" unit="°C" universe={C.universe.dpd} sets={C.dpd} />
            <MembershipChart title="Peluang hujan (output)" unit="%" universe={[0, 100]} sets={C.out} />
          </div>
          <RuleTable />
          <Calculator threshold={getEnv().predictThreshold} />
        </div>
        <div className="stamp" />
      </PageShell>
    </>
  );
}
