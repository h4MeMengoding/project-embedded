import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { toCsv } from '@/lib/csv';
import { buildExport, KINDS, type Kind } from '@/lib/exportRows';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(KINDS as readonly string[]).includes(kind)) return new Response('Jenis ekspor tidak dikenal', { status: 404 });
  const sp = new URL(req.url).searchParams;
  const from = new Date(sp.get('from') ?? '');
  const to = new Date(sp.get('to') ?? '');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return new Response('Rentang from/to tidak valid (ISO, from < to)', { status: 400 });
  }
  const { headers, rows } = await buildExport(getDb(), kind as Kind, getEnv().deviceId, from, to);
  return new Response(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${kind}_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
