import { eq } from 'drizzle-orm';
import { appConfig, type Db } from '@ws/db';

/** Seed hanya boleh jalan di proyek dev. Melempar jika app_config.environment bukan 'dev' atau tidak ada. */
export async function assertDevEnvironment(db: Db): Promise<void> {
  const rows = await db.select().from(appConfig).where(eq(appConfig.key, 'environment'));
  const v = rows[0]?.value;
  if (v !== 'dev') {
    throw new Error(`Seed ditolak: app_config.environment = ${v ?? '(tidak ada)'}, harus 'dev'.`);
  }
}
