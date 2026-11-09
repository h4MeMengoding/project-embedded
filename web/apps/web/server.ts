// Server kustom: Next.js + WebSocket (/ws/device, /ws/live) dalam satu proses.
// Route handler Next tidak bisa menerima upgrade WebSocket, jadi proses dimulai dari sini (npm run dev / start).
import { createServer } from 'node:http';
import { eq } from 'drizzle-orm';
import next from 'next';
import { devices, ingestPayload, verifyToken } from '@ws/db';
import { getDb } from './src/lib/db';
import { getEnv } from './src/lib/env';
import { attachWebSockets } from './src/lib/wsServer';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare(); // memuat next.config.ts (.env.local) dan instrumentation (cron)

  const env = getEnv();
  const server = createServer((req, res) => { void handle(req, res); });
  attachWebSockets(server, {
    deviceId: env.deviceId,
    offlineAfterSec: env.offlineAfterSec,
    tokenHash: async (id) => {
      const [row] = await getDb().select({ tokenHash: devices.tokenHash }).from(devices).where(eq(devices.id, id));
      return row?.tokenHash ?? null;
    },
    verifyToken,
    ingest: (p, now) => ingestPayload(getDb(), p.device_id, p, now, getEnv().predictThreshold),
  }, app.getUpgradeHandler());

  server.listen(port, () => console.log(`> http://localhost:${port}  ws: /ws/device, /ws/live (${dev ? 'dev' : 'produksi'})`));
}

main().catch((e) => { console.error(e); process.exit(1); });
