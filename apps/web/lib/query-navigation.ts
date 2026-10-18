export function formFingerprint(entries: Iterable<[string, FormDataEntryValue]>) {
  return JSON.stringify([...entries].map(([key, value]) => [key, String(value).trim()]).sort(([a], [b]) => a!.localeCompare(b!)));
}

export function queryHref(action: string, entries: Iterable<[string, FormDataEntryValue]>) {
  // As ações do painel são internas; nenhum parâmetro pode virar URL de destino.
  // Lista fechada: toda página com `QueryForm` precisa estar aqui (teste em query-ui.test.ts), senão o envio não navega.
  if (!/^\/(?:(?:municipios|exterior)\/\d+|exterior|mapa(?:\/candidaturas)?|perfis|participacao)?(?:#[a-z][a-z0-9-]*)?$/.test(action)) throw new Error('Ação de consulta inválida.');
  const [path, hash] = action.split('#');
  const params = new URLSearchParams();
  for (const [key, value] of entries) if (typeof value === 'string' && value.trim() !== '') params.append(key, value.trim());
  return `${path}${params.size ? `?${params}` : ''}${hash ? `#${hash}` : ''}`;
}

export function brazilHref(year: string, round: string) {
  return `/?${new URLSearchParams({ year, round })}`;
}

/** Retorno à consulta principal sem perder o cargo; cargos estaduais voltam à própria UF. */
export function overviewHref(year: string, round: string, office: string, uf?: string) {
  return office === 'president' ? brazilHref(year, round) : `/?${new URLSearchParams({ year, round, office, ...(uf ? { uf } : {}) })}`;
}
