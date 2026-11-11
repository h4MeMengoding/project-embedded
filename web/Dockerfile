# Build context: web/ (lihat .github/workflows/docker.yml). Server kustom (WebSocket) jadi tanpa output standalone.
FROM node:22-alpine
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node . .
RUN npm ci && npm run build

# NODE_ENV=production baru di sini: npm ci di atas butuh devDependencies (tsx, tailwind, typescript).
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Migrasi idempotent tiap start; gagal migrasi = container berhenti (tidak melayani dengan skema lama).
# Server dijalankan dari apps/web karena Next mencari app/ dan next.config.ts relatif terhadap cwd.
CMD ["sh", "-c", "npm run db:migrate -w @ws/db && cd apps/web && exec npx tsx server.ts"]
