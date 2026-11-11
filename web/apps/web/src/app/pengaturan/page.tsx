import { cookies } from 'next/headers';
import { getDeviceStatus, getMode, getSetting, listFirmware } from '@ws/db';
import { formatWib } from '@ws/core';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { ADMIN_COOKIE, isAdmin, isRegionLocked } from '@/lib/adminAuth';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { Card } from '@/components/Card';
import { LoginForm, LogoutButton } from '@/components/settings/LoginForm';
import { RegionPicker } from '@/components/settings/RegionPicker';
import { ModeCard, ResetCard } from '@/components/settings/ModeCard';
import { FirmwareCard } from '@/components/settings/FirmwareCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pengaturan · Stasiun Cuaca' };

export default async function Pengaturan() {
  const env = getEnv();
  const db = getDb();
  const pw = process.env.ADMIN_PASSWORD;
  const admin = isAdmin((await cookies()).get(ADMIN_COOKIE)?.value, pw);
  const [adm4, location, mode] = await Promise.all([getSetting(db, 'bmkg_adm4'), getSetting(db, 'bmkg_location'), getMode(db)]);
  const locked = isRegionLocked(env.evalStart, new Date());
  const [images, device] = admin
    ? await Promise.all([listFirmware(db), getDeviceStatus(db, env.deviceId, env.offlineAfterSec, new Date())])
    : [[], null];
  const activeCode = adm4 ?? (env.adm4 !== 'SEED' ? env.adm4 : null);

  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="pengaturan" />
          <div style={{ padding: '40px 0 120px' }}><h1 style={{ fontSize: 40, fontWeight: 800 }}>Pengaturan</h1></div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          <Card tone="light" title="Mode operasi" subtitle="Prod menyimpan data penelitian; dev hanya menampilkan pembacaan sensor live tanpa menyimpan">
            <div className="li">
              <span><small>Mode aktif</small><br /><b>{mode === 'prod' ? 'Produksi (data disimpan)' : 'Dev (data tidak disimpan)'}</b></span>
            </div>
            {admin && <ModeCard mode={mode} />}
          </Card>
          <Card tone="light" title="Wilayah prakiraan BMKG" subtitle="Kelurahan lokasi stasiun; dipakai untuk mengambil dan membandingkan prakiraan BMKG">
            <div className="li">
              <span>
                <small>Wilayah aktif</small><br />
                <b>{location ?? (activeCode ? activeCode : 'Belum disetel')}</b>
                {activeCode && <><br /><small>Kode {activeCode}{adm4 ? '' : ' (dari env BMKG_ADM4)'}</small></>}
              </span>
            </div>
            {locked ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Periode evaluasi sudah dimulai ({formatWib(env.evalStart as Date, 'datetime')} WIB). Wilayah dikunci agar semua slot dibandingkan dengan prakiraan wilayah yang sama.
              </p>
            ) : !pw ? (
              <p className="mt-4 text-sm text-[var(--muted)]">ADMIN_PASSWORD belum diisi di server. Isi di <code>.env</code> lalu mulai ulang web untuk mengubah pengaturan.</p>
            ) : !admin ? (
              <LoginForm />
            ) : (
              <>
                <RegionPicker />
                <div className="mt-6"><LogoutButton /></div>
              </>
            )}
            {mode === 'prod' && !activeCode && <p className="mt-4 text-sm font-semibold">Mode produksi aktif tetapi wilayah belum disetel: pilih wilayah di atas.</p>}
            <p className="mt-6 text-xs text-[var(--muted)]">Sumber: BMKG. Daftar wilayah: kode Kemendagri via wilayah.id.</p>
          </Card>
          {admin && mode === 'prod' && (
            <Card tone="light" title="Reset database" subtitle="Untuk mengulang penelitian dari awal">
              <ResetCard />
            </Card>
          )}
          {admin && device && (
            <Card tone="light" title="Pembaruan firmware (OTA)" subtitle="Unggah firmware.bin, lalu kirim ke ESP32 yang sedang online">
              <FirmwareCard
                items={images.map((i) => ({ id: i.id, version: i.version, sizeKb: Math.round(i.size / 1024), md5: i.md5, uploadedAt: formatWib(i.uploadedAt, 'datetime') + ' WIB' }))}
                online={device.online}
                fwVersion={device.fwVersion}
                ip={device.ip}
              />
            </Card>
          )}
        </div>
        <div className="stamp">Halaman lain tetap publik dan hanya baca</div>
      </PageShell>
    </>
  );
}
