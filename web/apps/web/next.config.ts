import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@ws/core', '@ws/db'],
};
export default config;
