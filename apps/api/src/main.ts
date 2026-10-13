import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createApp } from './app';
import { readConfig } from './config';

loadEnv({ path: resolve(__dirname, '../../../.env'), quiet: true });
async function bootstrap() {
  const config = readConfig(process.env);
  const app = await createApp(config);
  await app.listen(config.API_PORT, config.API_HOST);
}
bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao iniciar a API.');
  process.exitCode = 1;
});
