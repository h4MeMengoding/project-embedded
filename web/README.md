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
npm run dev            # http://localhost:3000 (server kustom: Next + WebSocket, jangan pakai `next dev`)
npm start              # produksi (setelah npm run build)
npm test               # semua workspace
npm run typecheck
npm run build
```

Halaman: `/` Beranda, `/riwayat`, `/evaluasi`, `/fuzzy`, `/perangkat`, `/pengaturan` (admin); ekspor CSV `/api/export/{readings|rain-events|predictions|bmkg|evaluation}?from=&to=` (ISO, UTC dan WIB).

## Catatan

- Wilayah BMKG disetel di `/pengaturan` (login `ADMIN_PASSWORD`), dicek ke BMKG sebelum disimpan, terkunci setelah `EVAL_START`. `BMKG_ADM4` di env hanya cadangan; kosong berarti `SEED`.
- Realtime: ESP membuka WebSocket `/ws/device` ke server dan mengirim heartbeat tiap 10 detik; browser menerima lewat WebSocket `/ws/live` (data baru tanpa refresh, offline terdeteksi setelah `DEVICE_OFFLINE_AFTER_SEC`, default 30 dtk).
- Cron di proses web (`src/instrumentation.ts`): ambil BMKG menit ke-5 tiap jam (dan saat start), hitung ulang evaluasi menit ke-10. `DISABLE_JOBS=1` mematikannya.

## Perangkat ESP32

```bash
npm run db:migrate -w @ws/db                  # sekali, menambah kolom devices.last_sensors
npm run device:create                         # pakai DEVICE_ID dari .env.local; cetak baris siap-salin untuk config.h
```

ESP32 menyambung ke `wss://domain/ws/device`, mengirim `hello` (device_id + token), lalu heartbeat tiap 10 detik dan record per menit yang dibalas `ack`. Protokol lengkap: `../CLAUDE.md` Bagian 5. Lihat `../esp/README.md`.
Uji tanpa hardware (Node 24 punya `WebSocket` bawaan; ganti `<token>`, dan `ts` = awal menit UTC terbaru):

```bash
node -e '
const ws = new WebSocket("ws://localhost:3000/ws/device");
ws.onopen = () => ws.send(JSON.stringify({type:"hello",device_id:"stasiun-01",token:"<token>"}));
ws.onmessage = (m) => { console.log(m.data); if (JSON.parse(m.data).type === "hello_ack") ws.send(JSON.stringify({id:1,device_id:"stasiun-01",fw:"dev",live:null,status:{ts:null,rssi:-60,uptime_s:1,heap_free:1,backlog:0,buffer_full:false,time_valid:true,sensors:{dht22:false,bmp280:true,bh1750:false,rain:true}},records:[{type:"minute",ts:1794234900,temp_dht:null,hum_dht:null,temp_bmp:27.9,pressure_hpa:985.3,lux:null,rain_analog_avg:3900,rain_wet_seconds:0,samples:6}]})); else process.exit(0); };
'
```
- Semua tampilan memakai WIB; database UTC.
- Mengubah parameter fuzzy wajib menaikkan `config_version` dan hanya sebelum periode evaluasi.
