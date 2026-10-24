import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { agreementReport, packet, validateSheet, type CodebookDefinition } from './rubric';
import { csv } from './rubric-core';
import { AXES, COMPASS_CRITERIA, COMPASS_EXCLUDED_TERMS, COMPASS_TERMS, COMPASS_THEME, COMPASS_VERSION, compassAgreement, MIN_ITEMS, polarity, positions, RESAMPLES, SCALE,
  STATEMENTS, validateCompass, type Axis } from './compass-core';

/**
 * Bússola política (livro de códigos em docs/bussola-livro-de-codigos.md), no mesmo fluxo da rubrica da D3 e sem publicação:
 * `pacote` gera o material idêntico para as duas codificações independentes; `concordancia` valida as planilhas, mede a concordância
 * (inclusive o kappa ponderado da escala) e, com a adjudicação, grava a codificação final e as posições calculadas.
 */
const COMPASS: CodebookDefinition = {
  version: COMPASS_VERSION, theme: COMPASS_THEME, codebook: 'docs/bussola-livro-de-codigos.md', dataDirectory: 'data/compass', command: 'compass:agreement',
  terms: COMPASS_TERMS, excludedTerms: COMPASS_EXCLUDED_TERMS, criteria: COMPASS_CRITERIA, validate: validateCompass,
  readingHint: 'Leia cada documento inteiro (documentos/ e textos/), não só o sumário e as seções de economia, trabalho, tributos, direitos, segurança, educação e meio ambiente; trechos-candidatos.csv (coluna criterios) é ponto de partida, não substitui a leitura. Codifique o que o plano diz, nunca o que a candidatura disse fora dele.',
  manifestExtra: { axes: AXES, scale: SCALE, minItems: MIN_ITEMS, resamples: RESAMPLES,
    statements: STATEMENTS.map((statement) => ({ code: statement.code, axis: statement.axis, pole: statement.pole, polarity: polarity(statement), text: statement.text })) },
  report: (a, b) => ({ compass: compassAgreement(a, b) }),
  afterFinal: async (final, documents, output) => {
    const result = positions(final, documents);
    await writeFile(resolve(output, 'posicoes.json'), `${JSON.stringify({ version: COMPASS_VERSION, axes: AXES, minItems: MIN_ITEMS, resamples: RESAMPLES, positions: result }, null, 2)}\n`);
    const axes = Object.keys(AXES) as Axis[];
    await writeFile(resolve(output, 'posicoes.csv'), csv([['documento', 'candidaturas', ...axes.flatMap((axis) => [`${axis}_afirmacoes`, `${axis}_situacao`, `${axis}_posicao`, `${axis}_ic95_inferior`, `${axis}_ic95_superior`])],
      ...result.map((item) => [item.document, item.candidacies, ...axes.flatMap((axis) => { const position = item.axes[axis];
        return [position.items, position.status, position.score?.toFixed(3) ?? '', position.interval?.[0].toFixed(3) ?? '', position.interval?.[1].toFixed(3) ?? '']; })])]));
  },
};

const command = process.argv[2];
if (require.main === module) (command === 'pacote' ? packet(COMPASS) : command === 'concordancia' ? agreementReport(COMPASS) : command === 'validacao' ? validateSheet(COMPASS)
  : Promise.reject(new Error('Comando: pacote, validacao ou concordancia.')))
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Bússola: falha.'); process.exitCode = 1; });
