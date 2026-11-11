# Stasiun Cuaca IoT + Prediksi Hujan Fuzzy Mamdani

Spesifikasi lengkap: [CLAUDE.md](CLAUDE.md). Firmware: [esp/README.md](esp/README.md). Web: [web/README.md](web/README.md).

## Deploy (VPS hanya menarik image dari GHCR)

Setiap push ke `main` menjalankan `.github/workflows/docker.yml`: typecheck + test, lalu build dan push
`ghcr.io/h4memengoding/project-embedded-web` (tag `latest`, `sha-<7 hex>`, dan `X.Y.Z` untuk tag git `vX.Y.Z`). VPS tidak membangun apa pun.

### Sekali saja
1. GitHub → Packages → `project-embedded-web` → Package settings: jadikan **Public**, atau buat PAT dengan scope `read:packages` dan di VPS jalankan
   `echo <PAT> | docker login ghcr.io -u h4MeMengoding --password-stdin`.
2. Di VPS: salin hanya `docker-compose.yml`, `Caddyfile`, dan `.env.example` (jadi `.env`, isi semua nilainya). Tidak perlu clone repo.
3. Buka port 80, 443/tcp, dan 443/udp. Arahkan DNS `DOMAIN` ke VPS.
4. `docker compose up -d`. Migrasi database berjalan otomatis saat container start.
5. Buat perangkat (token tampil sekali): `docker compose exec web npm run device:create -w @ws/db -- --id stasiun-01`.

### Update
```bash
docker compose pull && docker compose up -d
```
Rollback: set `WEB_TAG=sha-<commit lama>` di `.env`, lalu perintah yang sama.

Auto deploy: push ke `main` otomatis redeploy ke VPS lewat job `deploy` di workflow (SSH dengan kunci terbatas yang hanya bisa
menjalankan `/root/project-embedded/deploy.sh <tag>`; rollback otomatis jika container tidak sehat).
Update manual tetap bisa: `./deploy.sh sha-<commit>` di VPS.

### Catatan
- Jalankan **satu** instance `web`: cron BMKG/evaluasi dan hub WebSocket ada di memori proses.
- Image hanya `linux/amd64`. VPS ARM butuh `platforms: linux/amd64,linux/arm64` di workflow.
- Mengganti `ADMIN_PASSWORD` memutus semua sesi admin.
