'use client';
import { useEffect, useState } from 'react';

export type Choice = { value: string; label: string };
export type Remote<T> = { url: string; status: 'loading' | 'ready' | 'failed'; body: T | null };

/**
 * Busca por GET, sem enviar o formulário, as opções do recorte escolhido no navegador (`url`; nulo quando não há o que buscar).
 * Enquanto a resposta não chega, o estado é `loading`; uma resposta de um recorte anterior é descartada. `parse` recebe o corpo e
 * se a resposta foi bem-sucedida e devolve nulo quando não há opções utilizáveis (estado `failed`). Deve ser estável (fora do
 * componente): não entra nas dependências da busca.
 */
export function useRemoteChoices<T>(url: string | null, parse: (body: unknown, ok: boolean) => T | null): Remote<T> | null {
  const [remote, setRemote] = useState<Remote<T> | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => { const body = parse(await response.json(), response.ok); setRemote({ url, status: body ? 'ready' : 'failed', body }); })
      .catch(() => { if (!controller.signal.aborted) setRemote({ url, status: 'failed', body: null }); });
    return () => controller.abort();
  }, [url]);
  if (!url) return null;
  return remote?.url === url ? remote : { url, status: 'loading', body: null };
}
