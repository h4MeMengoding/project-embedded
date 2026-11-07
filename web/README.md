# Dashboard Web Stasiun Cuaca

Monorepo npm workspaces (Node 24+). Dashboard Next.js membaca Postgres lewat Drizzle; data uji berasal dari seed sintetis sampai ingest dan hardware tersedia.

```
web/
├─ apps/web        Next.js (App Router, Tailwind v4, Recharts)  @ws/web
├─ packages/core   logika murni: fuzzy Mamdani, meteo, evaluasi, teks  @ws/core
├─ packages/db     skema Drizzle, migrasi (+RLS), kueri, job evaluasi  @ws/db
├─ tools/seed      data sintetis 7 hari  @ws/seed
└─ docs/           desain dan rencana
```

## Menyiapkan database

Pilih salah satu:

- **Postgres lokal (Homebrew):** `brew install postgresql@16 && brew services start postgresql@16 && createdb weather_dev`, lalu `DATABASE_URL=postgres://<user>@localhost:5432/weather_dev`.
- **Supabase `dev`:** buat proyek, ambil connection string *session pooler* (port 5432) untuk migrasi. Runtime boleh memakai transaction pooler (6543); klien sudah memakai `prepare: false`.

Buat `web/.env.local` (lihat `.env.example`; minimal `DATABASE_URL` dan `DEVICE_ID`). Jangan commit file ini.

```bash
cd web
npm install
npm run db:migrate -w @ws/db          # tabel + RLS (tanpa policy)
npm run db:set-env -w @ws/db -- dev   # menandai database ini sebagai dev
```

## Seed

```bash
npm run seed -w @ws/seed -- --scenario normal --days 7
npm run seed -w @ws/seed -- --scenario offline|insufficient|disagree --reset
```

- Jendela 7 hari berakhir pada waktu dijalankan; aman diulang (idempoten). Jalankan ulang untuk menyegarkan data.
- `--reset` menghapus data perangkat seed dan baris BMKG `SEED` dulu (perlu saat berganti skenario).
- Skenario: `normal`, `offline` (data terhenti), `insufficient` (< 3 jam), `disagree` (BMKG berlawanan dengan sensor).
- **Seed hanya untuk database `dev`.** Seed menolak jalan jika `app_config.environment` bukan `dev`. Baris BMKG sintetis memakai `adm4 = 'SEED'`.

## Menjalankan

```bash
npm run dev            # http://localhost:3000
npm test               # semua workspace
npm run typecheck
npm run build
```

Halaman: `/` Beranda, `/riwayat`, `/evaluasi`, `/fuzzy`, `/perangkat`; ekspor CSV `/api/export/{readings|rain-events|predictions|bmkg|evaluation}?from=&to=` (ISO, UTC dan WIB).

## Catatan

- `BMKG_ADM4` kosong berarti `SEED`. Jangan menebak kode wilayah; isi setelah diverifikasi.
- Semua tampilan memakai WIB; database UTC.
- Mengubah parameter fuzzy wajib menaikkan `config_version` dan hanya sebelum periode evaluasi.
