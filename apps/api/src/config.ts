import { z } from 'zod';

export const CONFIG = Symbol('configuration');
function parseUrl(value: string): URL | null {
  try { return new URL(value); } catch { return null; }
}
const schema = z.object({
  DATABASE_URL: z.url().refine((value) => ['postgres:', 'postgresql:'].includes(parseUrl(value)?.protocol ?? ''), 'Use uma URL PostgreSQL.'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  WEB_ORIGIN: z.url().refine((value) => {
    const url = parseUrl(value);
    return url !== null && ['http:', 'https:'].includes(url.protocol) && value === url.origin;
  }, 'Informe uma origem HTTP sem caminho ou barra final.').default('http://localhost:3000'),
});
export type AppConfig = z.infer<typeof schema>;
export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Não incluir valores nem credenciais na mensagem de erro.
    throw new Error(`Configuração inválida: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}. Consulte .env.example.`);
  }
  return result.data;
}
