import { OFFICES, OFFICE_LABELS, type Office } from '@observatorio/contracts';

const PILOT_SCOPE = '2022/president/SP/71072';
/**
 * Publicações que não são resultados por cargo: não têm cobertura por município e zona (`import_coverage`) e são descritas na
 * própria seção de `/fontes` (ou na metodologia, para os grupos de locais).
 */
const SECTION_SCOPES: Record<string, { label: string; href: string }> = {
  '2022/context/municipal': { label: 'Contexto municipal 2022 — Censo 2022 (IBGE) e perfis do TSE', href: '#contexto' },
  '2022/context/income-bands': { label: 'Moradores por faixa de renda do setor 2022 (IBGE)', href: '#faixas-renda' },
  '2022/context/turnout-profiles': { label: 'Comparecimento e abstenção por perfil 2022 (TSE)', href: '#participacao' },
  '2022/context/tract-demography': { label: 'Moradores por faixa de perfil do setor 2022 (IBGE)', href: '#demografia-setores' },
  '2022/context/urban-surroundings': { label: 'Entorno dos domicílios 2022 (IBGE)', href: '#entorno' },
  '2022/maps/ibge': { label: 'Malhas para mapas 2022 (IBGE)', href: '#malhas' },
  '2022/places/tracts': { label: 'Locais de votação e setores censitários 2022', href: '#setores' },
  '2022/places/profiles': { label: 'Perfil do eleitorado por local de votação 2022', href: '#perfil-locais' },
  '2022/places/groups': { label: 'Grupos de locais de votação 2022 (métrica E)', href: '/metodologia#perfis' },
  '2022/places/tract-sensitivity': { label: 'Sensibilidade da associação local → setor 2022', href: '#sensibilidade-setores' },
  '2022/geo/tracts': { label: 'Malha de setores censitários 2022 (IBGE)', href: '#malha-setores' },
  '2022/geo/tract-display': { label: 'Desenho dos setores para o mapa 2022', href: '#desenho-setores' },
  '2022/proposals/president': { label: 'Propostas de governo da Presidência 2022 (TSE)', href: '#propostas' },
};

/** Escopo de importação: ano/cargo/território (ex.: 2022/governor/SP) ou uma publicação com seção própria. */
export function scopeLabel(scope: string) {
  const section = SECTION_SCOPES[scope];
  if (section) return section.label;
  const [year, office, territory] = scope.split('/');
  const label = (OFFICES as readonly string[]).includes(office ?? '') ? OFFICE_LABELS[office as Office] : office;
  return `${label} ${year} — ${territory === 'BR' ? 'municípios das 27 UFs' : territory === 'ZZ' ? 'exterior' : territory}`;
}

/**
 * Importação sem linhas de cobertura: só o piloto publicado tem cobertura conhecida (São Paulo, ambos os turnos); uma publicação
 * com seção própria remete a ela; qualquer outra não tem cobertura registrada. Nada é presumido de uma versão não publicada.
 */
export function importWithoutCoverage(scope: string, published: boolean) {
  if (!published) return { kind: 'none' } as const;
  if (scope === PILOT_SCOPE) return { kind: 'pilot' } as const;
  const section = SECTION_SCOPES[scope];
  return section ? { kind: 'section', ...section } as const : { kind: 'none' } as const;
}
