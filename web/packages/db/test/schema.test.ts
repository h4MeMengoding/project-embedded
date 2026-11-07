import { describe, it, expect, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { HAS_DB, testDb } from './helpers';
import { readingsMinute, appConfig } from '../src/schema';

const TABLES = ['devices', 'readings_minute', 'rain_events', 'fuzzy_predictions', 'bmkg_forecasts', 'evaluation_slots', 'app_config'];
const dev = `test-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!HAS_DB)('schema', () => {
  const db = HAS_DB ? testDb() : (null as never);
  afterAll(async () => {
    await db.delete(readingsMinute).where(eq(readingsMinute.deviceId, dev));
  });

  it('runs only against dev', async () => {
    const r = await db.select().from(appConfig).where(eq(appConfig.key, 'environment'));
    expect(r[0]?.value).toBe('dev');
  });
  it('has all seven tables', async () => {
    const r = await db.execute(sql`select table_name from information_schema.tables where table_schema='public'`);
    const names = (r as unknown as { table_name: string }[]).map((x) => x.table_name);
    for (const t of TABLES) expect(names).toContain(t);
  });
  it('rls enabled on all', async () => {
    const r = await db.execute(sql`select relname, relrowsecurity from pg_class where relname in (${sql.join(TABLES.map((t) => sql`${t}`), sql`, `)}) and relkind='r'`);
    const rows = r as unknown as { relname: string; relrowsecurity: boolean }[];
    expect(rows).toHaveLength(7);
    rows.forEach((x) => expect(x.relrowsecurity).toBe(true));
  });
  it('unique (device_id, ts)', async () => {
    const ts = new Date('2026-01-01T00:00:00Z');
    await db.insert(readingsMinute).values({ deviceId: dev, ts }).onConflictDoNothing();
    await db.insert(readingsMinute).values({ deviceId: dev, ts }).onConflictDoNothing();
    const r = await db.select().from(readingsMinute).where(eq(readingsMinute.deviceId, dev));
    expect(r).toHaveLength(1);
  });
  it('all time columns are timestamptz', async () => {
    const r = await db.execute(sql`select table_name, column_name, data_type from information_schema.columns where table_schema='public' and data_type like 'timestamp%'`);
    const rows = r as unknown as { data_type: string }[];
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((x) => expect(x.data_type).toBe('timestamp with time zone'));
  });
});
