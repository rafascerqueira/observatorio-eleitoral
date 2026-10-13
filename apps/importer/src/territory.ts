import { STATES } from '@observatorio/contracts';

/** Código TSE numérico em representação canônica de cinco dígitos.
 * Não usa nome como chave e não confunde esse identificador com código IBGE.
 */
export function municipalityCode(value: string): string {
  if (!/^\d{1,5}$/.test(value) || Number(value) === 0) throw new Error('Código municipal TSE inválido.');
  return value.padStart(5, '0');
}
export function territoryKey(uf: string, code: string) { return `${uf}-${municipalityCode(code)}`; }
export function normalizeTerritoryKey(key: string) {
  const match = /^([A-Z]{2})-(\d+)$/.exec(key);
  if (!match) throw new Error('Chave territorial inválida.');
  return territoryKey(match[1]!, match[2]!);
}
export function assertNationalTerritories(territories: Array<{ uf: string }>) {
  const present = new Set(territories.map((item) => item.uf));
  const missing = STATES.filter((uf) => !present.has(uf));
  if (missing.length) throw new Error(`Cobertura nacional incompleta: UFs ausentes ${missing.join(', ')}. Publicação bloqueada.`);
}
