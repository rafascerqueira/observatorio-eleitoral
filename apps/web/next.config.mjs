import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const root = resolve(process.cwd(), '../..');
loadEnv({ path: resolve(root, '.env'), quiet: true });
export default {
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
  experimental: { agentUpgrade: 'security' },
};
