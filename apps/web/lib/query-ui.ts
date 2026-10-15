import { municipalityQuerySchema, placesQuerySchema, exteriorQuerySchema, isStateOffice, OFFICE_LABELS, type Office } from '@observatorio/contracts';

export type RawQuery = Record<string, string | string[] | undefined>;
export type QueryError = { field: string; message: string };
type Issue = { path: readonly PropertyKey[]; code: string; keys?: string[] };

export const UF_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

export function rawValue(query: RawQuery, field: string, fallback: string | number = '') {
  const value = query[field];
  return (Array.isArray(value) ? value[0] : value) ?? String(fallback);
}

// Recupera somente contexto para renderização. Uma consulta inválida nunca chama a API.
export function recoverQuery(query: RawQuery, mode: 'municipalities' | 'places' | 'exterior') {
  const shape = mode === 'places' ? placesQuerySchema.shape : mode === 'exterior' ? exteriorQuerySchema.shape : municipalityQuerySchema.shape;
  return Object.fromEntries(Object.entries(query).filter(([key, value]) => {
    const validator = shape[key as keyof typeof shape];
    return validator && validator.safeParse(value).success;
  }));
}

/** Cargo estadual sem UF não é consultado: não há consolidado Brasil nem exterior para ele. */
export function officeScopeError(office: Office, uf: string | undefined): QueryError | null {
  if (!isStateOffice(office) || (uf && uf !== 'ZZ')) return null;
  return { field: 'uf', message: `${OFFICE_LABELS[office]} é cargo estadual: escolha uma das 27 UFs.${uf === 'ZZ' ? ' Eleitores no exterior não votam para esse cargo.' : ''}` };
}

export function queryErrors(query: RawQuery, issues: readonly Issue[], mode: 'municipalities' | 'places' = 'municipalities'): QueryError[] {
  const instructions: Record<string, string> = {
    year: 'Escolha uma eleição disponível no seletor: 2022 ou 2026.',
    round: 'Escolha o 1º ou o 2º turno.',
    office: 'Escolha um cargo disponível no seletor: Presidência ou Governador.',
    uf: mode === 'places' ? 'A UF do endereço é inválida. Uma nova busca remove esse valor; volte à consulta municipal para escolher outra UF.' : 'Escolha Todo o Brasil ou uma das 27 UFs.',
    zone: 'Informe uma zona de 1 a 9999, usando apenas números. Zeros iniciais são aceitos.',
    section: 'Informe uma seção de 1 a 99999, usando apenas números. Zeros iniciais são aceitos.',
    local: 'Informe um código do local de 1 a 99999, usando apenas números.',
    search: 'Use até 100 caracteres na busca.',
    page: 'A página deve estar entre 1 e 1.000.000. Uma nova consulta começa na primeira página.',
    pageSize: 'A quantidade por página deve estar entre 1 e 100.',
    sort: 'A ordenação deve ser por município ou UF. Uma nova consulta restaura a ordenação padrão.',
    direction: 'A direção deve ser asc ou desc. Uma nova consulta restaura a direção padrão.',
  };
  const errors = new Map<string, QueryError>();
  for (const issue of issues) {
    const field = String(issue.path[0] ?? 'query');
    const message = issue.code === 'unrecognized_keys'
      ? `O endereço contém filtros não reconhecidos: ${(issue.keys ?? []).join(', ')}. Uma nova consulta os remove.`
      : Array.isArray(query[field]) ? `O filtro ${field} aparece mais de uma vez. Escolha um único valor e consulte novamente.`
      : instructions[field] ?? 'Confira este filtro e consulte novamente.';
    errors.set(field, { field, message });
  }
  return [...errors.values()];
}

