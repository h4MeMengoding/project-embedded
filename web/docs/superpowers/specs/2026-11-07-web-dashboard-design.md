# Desain: Dashboard Web Stasiun Cuaca (dibangun lebih dulu dari hardware)

Tanggal: 2026-11-07. Status: menunggu persetujuan pengguna (sudah diperiksa reviewer; keputusan hasil pemeriksaan ada di bagian 11b).
Dokumen induk: `/CLAUDE.md` (spesifikasi seluruh sistem). Dokumen ini hanya mencakup bagian web dan fondasi yang dibutuhkannya, dan menyebut dengan jelas di mana ia menyimpang dari CLAUDE.md.

## 1. Maksud dan alasan

Hardware (ESP32 dan sensor) masih dalam pembelian. Pengguna ingin mengerjakan dashboard lebih dulu, dengan syarat tegas: **tidak ada pekerjaan yang terbuang**. Semua yang dibuat sekarang harus terpakai apa adanya saat ingest service, simulator, dan firmware menyusul. Karena itu web dibangun di atas fondasi yang sama dengan produksi (skema database, mesin fuzzy, kueri evaluasi), bukan di atas data tiruan yang nanti dibuang.

Dashboard punya dua fungsi: memantau stasiun secara langsung, dan menyajikan hasil penelitian (perbandingan fuzzy Mamdani vs prakiraan BMKG) untuk makalah jurnal BEES. Inti penelitian adalah prediksi hujan 3 jam, jadi itulah yang paling menonjol di halaman utama.

## 2. Tujuan, bukan-tujuan, anti-tujuan

**Tujuan**
- Semua halaman Bagian 11 CLAUDE.md (Beranda, Riwayat, Evaluasi, Fuzzy, Perangkat) dan ekspor CSV berjalan penuh terhadap database asli yang berisi data seed.
- Tampilan modern, lega, dan konsisten dengan mockup Beranda yang sudah disetujui (lihat bagian 6).
- Kode web, `core`, dan `db` tidak perlu diubah saat ingest dan hardware datang.

**Bukan-tujuan (dikerjakan nanti, di luar dokumen ini)**
- Ingest service, WebSocket server, cron BMKG, simulator, firmware, docker-compose, Caddy.
- Parser BMKG yang final (menunggu respons asli, lihat bagian 4).
- Autentikasi dashboard (default publik, hanya baca).

**Anti-tujuan (dianggap gagal walau teknis berjalan)**
- Data seed sintetis tercampur dengan data penelitian asli.
- Halaman terasa ramai atau sumpek; angka yang penting tidak langsung terbaca.
- Ada kode yang hanya berguna selama hardware belum ada.
- Angka atau teks sintetis tampil seolah-olah data asli (kecuali di lingkungan dev yang jelas ditandai).

## 3. Batasan

- Semua keputusan di CLAUDE.md Bagian 1 dan larangan Bagian 17 berlaku (fuzzy Mamdani, tanpa ML, tanpa sensor tambahan, atribusi "Sumber: BMKG", waktu UTC di database dan WIB di tampilan, token perangkat tidak disimpan polos, dan seterusnya).
- **Semua kode web berada di dalam folder `web/`** (permintaan pengguna). Folder `esp/` dibiarkan untuk firmware nanti.
- Database: **Supabase (PostgreSQL)**, dengan **Drizzle ORM** (keputusan final di CLAUDE.md). Bukan Prisma, bukan CLI Supabase untuk migrasi.
- **Dua proyek Supabase: `dev` dan `prod`.** Data seed hanya boleh masuk ke `dev`. Proyek `prod` baru dibuat saat hardware siap dan hanya menerima data asli.
- Tabel Drizzle dibuat di skema `public`, jadi **RLS wajib aktif di semua tabel tanpa policy**, supaya REST API Supabase (anon key) tidak bisa membaca `devices.token_hash` dan tabel lain. Aplikasi memakai role `postgres` lewat connection string, yang tidak terkena RLS.
- Migrasi dijalankan lewat direct connection atau session pooler (port 5432). Runtime aplikasi boleh memakai transaction pooler (6543) dengan `prepare: false`.
- Node 24 dan npm sudah ada di mesin pengembang. Docker dan Postgres lokal tidak ada dan tidak dibutuhkan.
- `BMKG_ADM4` belum diketahui dan tidak boleh ditebak.

## 4. Pendekatan yang dipertimbangkan

| | Pendekatan | Kelebihan | Kekurangan |
|---|---|---|---|
| A | Data tiruan saja, tanpa database | Paling cepat jalan | Skema dan semua kueri (rata-rata, celah data, latensi, evaluasi) belum teruji; paling banyak yang terbuang |
| **B** | **Monorepo sesuai spec, web membaca Supabase asli yang diisi seed** | **Tidak ada yang terbuang; kueri evaluasi dan kelengkapan teruji lebih awal** | **Butuh akun Supabase dev; tampilan pertama sedikit lebih lambat** |
| C | Antarmuka akses data dengan dua implementasi (mock sekarang, Drizzle nanti) | Tampilan pertama cepat | Menulis dua implementasi; mock dan DB asli bisa berperilaku beda |

**Dipilih: B** (oleh pengguna, berdasarkan rekomendasi). Alasan: hanya B yang memenuhi syarat "tidak ada yang sia-sia".

Implikasi B untuk BMKG: tabel `bmkg_forecasts` diisi data **sintetis** berformat sama dengan field yang diketahui (Bagian 8 CLAUDE.md) sampai ada respons asli dan `BMKG_ADM4`. Baris sintetis ditandai (`raw` berisi `{"synthetic": true}`, `adm4` berisi nilai penanda seperti `SEED`). Parser BMKG tidak ditulis sekarang; hanya pemetaan "prediksi hujan" (kata "Hujan" atau kode {60, 61, 63, 80, 95, 97}) yang sudah ditetapkan di CLAUDE.md dan boleh diimplementasikan di `core`.

## 5. Struktur kode (di dalam `web/`)

`web/` menjadi monorepo mini dengan npm workspaces. Ingest dan firmware nanti ditambahkan di luar `web/` (atau di dalamnya, sesuai keputusan saat itu) dan memakai paket yang sama.

```
web/
├─ package.json            # workspaces
├─ apps/web/               # Next.js (App Router, TypeScript, Tailwind, Recharts)
├─ packages/core/          # logika murni tanpa I/O: fuzzy, fuzzyConfig, meteo, evaluation, pemetaan BMKG
├─ packages/db/            # skema Drizzle, migrasi, klien, kueri bersama (+ job evaluasi)
├─ tools/seed/             # pengisi data sintetis (nanti digantikan simulator)
├─ docs/design/            # mockup yang disetujui
└─ docs/superpowers/specs/ # dokumen ini
```

Nama dan susunan di dalam `apps/web` diserahkan ke builder (permintaan pengguna: tidak perlu sama dengan CLAUDE.md). Skema tabel mengikuti Bagian 6 CLAUDE.md tanpa perubahan, ditambah tabel `app_config` yang dipakai untuk penanda lingkungan (lihat bagian 7).

## 6. Desain visual (sudah disetujui lewat mockup)

Acuan: `web/docs/design/beranda-v6.html` (buka di browser). Gaya berasal dari referensi "Greenish": hero hijau bergradasi, kartu yang menimpa tepi hero, sudut membulat besar.

**Tata letak desktop:** lebar konten `clamp(1120px, 80vw, 1440px)`, padding bingkai 64px, jarak antarkartu 28px, padding dalam kartu 32px. Prinsipnya: lega; maksimal tiga kartu per baris.

**Tipografi:** satu keluarga font, **Plus Jakarta Sans** (400–800). Skala ukuran tetap: 13 / 15 / 20 / 40 / ±120 px. Tidak ada teks di bawah 13px, tidak ada letter-spacing negatif, angka memakai tabular-nums.

**Warna:** hijau hero `#1b6232 → #4aa653`, kuning aksen `#ffc93c`/`#f7d04a`, kartu gelap `#12331f`, latar halaman `#e9f0e9`. Mode gelap wajib (CLAUDE.md Bagian 11): token warna dibuat sebagai variabel agar bisa dibalik; rancangan mode gelap diserahkan ke builder dengan gaya yang sama.

**Responsif:** harus nyaman di HP (kolom tunggal, kartu bertumpuk). Mockup hanya desktop; tampilan HP diserahkan ke builder.

**Aksesibilitas:** kontras teks pada hijau diperiksa; animasi mati pada `prefers-reduced-motion`; gauge punya teks alternatif.

**Hero Beranda:**
- Cincin tebal 270° (opsi A terpilih) dengan angka peluang di tengah, gradasi hijau-kuning-oranye.
- Di kanan cincin: rentang jam prediksi, satu kalimat penjelas, dua pil status.
- Stasiun cuaca SVG beranimasi di kanan hero (sinar BH1750, tetes hujan di pelat FC-37, LED dan gelombang WiFi di kotak ESP32) dengan label sensor kecil. Hanya sensor yang ada di CLAUDE.md Bagian 1 yang boleh digambar.
- Baris lima sensor di atas hijau: suhu, kelembapan, tekanan, cahaya, titik embun.
- Tiga kartu menimpa tepi hero: riwayat peluang (gelap), prakiraan BMKG (kuning, wajib "Sumber: BMKG"), aktivitas hujan.

**Copywriting (keputusan pengguna):**
- Kategori fuzzy ditampilkan sebagai kalimat, bukan kata tunggal: Rendah → "Kemungkinan kecil hujan", Sedang → "Mungkin hujan" (usulan; builder boleh menyempurnakan), Tinggi → "Kemungkinan besar akan turun hujan".
- Kesepakatan: "BMKG juga memperkirakan hujan" atau "BMKG memperkirakan tidak hujan". Kata "fuzzy" dipakai hanya di halaman Fuzzy dan keterangan teknis kecil.
- Kondisi sekarang dari sensor hujan: "Saat ini masih kering" / "Saat ini sedang hujan". Jangan menaruhnya sebagai "Tidak hujan" di samping peluang tinggi, karena terbaca bertentangan.
- Fuzzy `insufficient_data`: gauge kosong dengan teks "Menunggu 3 jam data tekanan".
- Perangkat offline: indikator berubah dan data terakhir diberi waktu; angka tidak disembunyikan.

## 7. Data dan lapisan database

- **Skema:** persis Bagian 6 CLAUDE.md, lewat Drizzle, dengan migrasi. RLS diaktifkan di semua tabel (migrasi SQL), tanpa policy.
- **Penanda lingkungan:** baris `app_config` dengan key `environment` (`dev` atau `prod`). Skrip seed menolak berjalan kecuali nilainya `dev`, sehingga data sintetis tidak pernah masuk ke proyek produksi walau `DATABASE_URL` tertukar.
- **Seed (`tools/seed`):** mengisi sekitar 7 hari data per menit (sesuai durasi penelitian) dengan suhu harian, tekanan dengan siklus ±1,5 hPa, kejadian hujan acak, beberapa celah offline (termasuk backfill), serta `rain_events`. Prediksi fuzzy dihitung memakai `packages/core` yang asli. Prakiraan BMKG sintetis ditandai seperti di bagian 4. Evaluasi dihitung memakai fungsi evaluasi yang sama dengan produksi. Seed bersifat idempoten (aman dijalankan ulang).
- **Data real-time:** hook `useLive` mencoba WebSocket ke `PUBLIC_WS_URL` (`/ws/live`); jika gagal atau belum ada, jatuh ke polling endpoint route handler yang membaca data terbaru dari database. Saat ingest ada, hook tidak diubah.
- **Evaluasi:** logika murni di `core/evaluation` (slot, label hujan, metrik); kueri dan penulisan `evaluation_slots` di `packages/db` sebagai fungsi yang bisa dipanggil dari web (tombol "Hitung ulang evaluasi") dan dari ingest nanti.
- **Waktu:** database UTC, tampilan Asia/Jakarta di semua halaman dan CSV (dua kolom).

## 8. Halaman

Isi tiap halaman mengikuti CLAUDE.md Bagian 11. Gaya visual mengikuti bagian 6. Hanya Beranda yang sudah dimockup; halaman lain dirancang builder dengan token dan komponen yang sama, lalu ditinjau pengguna di browser.

- **Beranda `/`:** sesuai mockup. Tidak memuat tabel status sensor dan panel perangkat (dipindah ke Perangkat).
- **Riwayat `/riwayat`:** rentang 6 jam, 24 jam, 7 hari, kustom; grafik suhu (DHT22 dan BMP280 satu grafik), kelembapan, tekanan, lux, peluang fuzzy; area berarsir saat hujan; tombol unduh CSV.
- **Evaluasi `/evaluasi`:** pemilih periode (default `EVAL_START`–`EVAL_END`), tabel per slot, dua confusion matrix berdampingan, tabel metrik, keterangan asumsi (definisi hujan, ambang, mode slot, tabel pemetaan BMKG), tombol hitung ulang, unduh CSV. Slot data tidak lengkap ditandai dan dikecualikan dari metrik.
- **Fuzzy `/fuzzy`:** grafik empat fungsi keanggotaan berkualitas tangkapan layar makalah, tabel 27 aturan, kalkulator langkah demi langkah, pilihan memuat data menit tertentu. Memakai `core` langsung (halaman ini tidak butuh database untuk kalkulator).
- **Perangkat `/perangkat`:** status, RSSI, uptime, heap, backlog, `buffer_full`, firmware, terakhir terlihat; kelengkapan data per hari dan total; statistik latensi; daftar periode offline; tabel status sensor yang dipindah dari Beranda.
- **Ekspor `/api/export/{readings|rain-events|predictions|bmkg|evaluation}?from=&to=`:** CSV dengan header jelas dan dua kolom waktu.

## 9. Pengujian

- `packages/core`: vitest sesuai Bagian 13 CLAUDE.md (batas fungsi keanggotaan, titik embun T=30 RH=70 → ≈23,9 °C, minimal 5 kasus fuzzy hitung manual, slot, label hujan termasuk data tidak lengkap, metrik termasuk pembagian nol).
- Web: pengecekan tipe dan build lulus; setiap halaman dibuka di browser terhadap data seed dan diperiksa di lebar desktop dan HP; kasus `insufficient_data`, offline, dan fuzzy berbeda dengan BMKG diuji dengan data seed khusus.
- Ekspor CSV: dibandingkan dengan isi tabel.

## 10. Urutan kerja yang disarankan

1. Scaffold `web/` (workspaces, TypeScript, Tailwind, Next.js) dan token desain.
2. `packages/core` + test.
3. `packages/db` (skema, migrasi, RLS) dan `tools/seed` terhadap proyek Supabase dev.
4. Kerangka aplikasi (tema, navigasi, mode gelap) dan Beranda sesuai mockup.
5. Fuzzy, Riwayat, Evaluasi, Perangkat, ekspor CSV.

## 11. Menyimpang dari CLAUDE.md (perlu diperbarui setelah persetujuan)

- Bagian 2.1 (struktur repositori): `packages/` dan `tools/` kini di dalam `web/`; `apps/ingest` dan firmware menyusul. Folder firmware sementara bernama `esp/`.
- Bagian 14: `docker-compose.yml` tidak lagi punya service `postgres`; `DATABASE_URL` menunjuk ke Supabase. Pencadangan harian `pg_dump` perlu ditinjau ulang (Supabase punya cadangan sendiri, tetapi ekspor mandiri untuk data penelitian tetap dianjurkan).
- Bagian 11.1: tabel sensor dan panel perangkat tidak ada di Beranda (sudah sesuai spec, hanya penegasan).
- Teks tampilan (copywriting) di bagian 6 menggantikan teks lama yang belum ditetapkan di CLAUDE.md.

## 11b. Keputusan yang diambil penulis dokumen (bukan hasil persetujuan pengguna)

Hasil pemeriksaan oleh reviewer; semuanya bisa dikoreksi pengguna.

- **Tempat web berjalan:** di VPS dalam Docker di belakang Caddy, sesuai Bagian 14 CLAUDE.md (asal-usul sama dengan `/ws/live`, tanpa CORS). Memilih Supabase sebagai database tidak mengubah ini. Klien database ditulis agar jalan di kedua lingkungan (pooled, `prepare: false`, `PUBLIC_WS_URL` dari env), sehingga pindah ke hosting serverless nanti hanya mengubah dokumen deploy.
- **Seed berakhir di "sekarang":** skrip seed membuat jendela 7 hari yang berakhir pada waktu dijalankan, dan aman dijalankan ulang (idempoten) untuk menyegarkan data. Dengan begitu Beranda tampil online, prediksi terbaru ada, dan slot BMKG saat ini serta dua berikutnya terisi. Prakiraan BMKG sintetis dibuat untuk rentang yang mencakup waktu sekarang sampai 3 hari ke depan.
- **Skenario khusus lewat flag seed:** satu flag per kasus yang perlu diuji tampilannya: perangkat offline, `insufficient_data` (data kurang dari 3 jam), dan fuzzy berbeda dengan BMKG.
- **Periode evaluasi bawaan terhadap seed:** bila `EVAL_START`/`EVAL_END` kosong, halaman Evaluasi memakai seluruh jendela data yang ada.
- **Tombol "Hitung ulang evaluasi":** halaman publik tanpa login, jadi endpoint-nya diberi pembatasan laju sederhana (misalnya satu kali per menit per IP). Tombol hanya menulis ulang `evaluation_slots`, yang turunan dan bisa dihitung ulang kapan saja, sehingga tidak ada data mentah yang berisiko.

## 12. Hal yang dibutuhkan dari pengguna (tidak menghalangi pekerjaan web)

- Dua proyek Supabase (dev dan prod) dan connection string-nya; untuk tahap web cukup **dev**.
- `BMKG_ADM4`, domain VPS, keputusan DS3231, nilai kalibrasi `RAIN_WET_THRESHOLD`, tanggal `EVAL_START`/`EVAL_END`, dan apakah dashboard perlu kata sandi (Bagian 16 CLAUDE.md). Tidak satu pun dibutuhkan untuk menyelesaikan web.

## 13. Diserahkan kepada builder

Nama dan susunan folder di dalam `apps/web`; pustaka komponen; rancangan mode gelap dan HP; desain halaman selain Beranda; pustaka grafik tambahan bila Recharts tidak cukup untuk grafik keanggotaan; versi paket; format tepat teks kategori Sedang; bentuk endpoint polling; strategi caching kueri.
