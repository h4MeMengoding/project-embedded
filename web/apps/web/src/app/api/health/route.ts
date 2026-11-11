export const dynamic = 'force-dynamic';

/** Healthcheck container: tanpa akses database, hanya membuktikan proses melayani HTTP. */
export function GET() {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
