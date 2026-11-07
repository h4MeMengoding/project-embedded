import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// env ada di web/.env.local (root workspace), bukan di apps/web
try {
  process.loadEnvFile(resolve(__dirname, '../../.env.local'));
} catch {}

const config: NextConfig = {
  transpilePackages: ['@ws/core', '@ws/db'],
};
export default config;
