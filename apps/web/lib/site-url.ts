export const DEFAULT_SITE_URL = 'http://localhost:3000';

/**
 * Origem pública das imagens de compartilhamento (`metadataBase`). `SITE_URL` ausente ou vazia vale o padrão local (um
 * `SITE_URL=` no `.env` derrubava todas as páginas); valor inválido interrompe com mensagem própria, em vez de publicar endereços
 * de compartilhamento errados.
 */
export function siteUrl(value: string | undefined): URL {
  const text = value?.trim();
  if (!text) return new URL(DEFAULT_SITE_URL);
  let url: URL;
  try { url = new URL(text); } catch { throw new Error(`SITE_URL inválida: "${text}". Use uma origem absoluta, como https://exemplo.org.`); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`SITE_URL precisa usar http ou https: "${text}".`);
  return url;
}
