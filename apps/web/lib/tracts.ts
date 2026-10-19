import type { TRACT_STATUSES } from '@observatorio/contracts';

type TractStatus = typeof TRACT_STATUSES[number];
/** Situação da associação local → setor, com os mesmos nomes na transparência e no cartão do local. */
export const TRACT_STATUS_LABELS: Record<TractStatus, string> = {
  associated: 'Associado', 'no-coordinate': 'Sem coordenada', 'conflicting-coordinates': 'Coordenadas conflitantes', relocated: 'Seção realocada depois de 2022',
  'outside-tracts': 'Fora dos setores', 'other-municipality': 'Em setor de outro município', ambiguous: 'Na divisa de setores',
};
/** Por que o local ficou sem setor: em caso de dúvida, nenhum setor é escolhido. */
export const TRACT_STATUS_REASONS: Record<Exclude<TractStatus, 'associated'>, string> = {
  'no-coordinate': 'O cadastro de locais do TSE não traz coordenada válida para este local.',
  'conflicting-coordinates': 'O cadastro do TSE traz coordenadas diferentes para seções deste local; nenhuma foi escolhida.',
  relocated: 'Alguma seção deste local passou a outro prédio no cadastro do TSE, gerado depois de 2022: a coordenada pode ser do prédio novo, então o local não foi associado.',
  'outside-tracts': 'A coordenada do TSE fica fora da malha de setores do IBGE.',
  'other-municipality': 'A coordenada do TSE cai num setor de outro município; o local não foi associado.',
  ambiguous: 'A coordenada do TSE fica na divisa entre setores; nenhum foi escolhido.',
};
