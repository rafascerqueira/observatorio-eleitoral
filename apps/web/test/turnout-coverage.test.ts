import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roundNote, turnoutCoverage } from '../lib/turnout-coverage';

const source = (generatedAt: string[]) => ({ file: 'f.zip', entry: 'e', url: 'u', sha256: 'h', downloadedAt: 'd', generatedAt, lastModified: null }) as never;

test('cobertura do comparecimento por perfil: turnos, UFs ausentes e data de geração, pela publicação mais recente do ano', () => {
  const coverage = turnoutCoverage([
    { year: 2022, importedAt: '2026-10-19T00:00:00Z', missingUfs: ['DF'], sources: [source(['29/04/2025 22:31:40 (America/Sao_Paulo)'])] },
    { year: 2026, importedAt: '2026-10-30T00:00:00Z', rounds: ['1', '2'], missingUfs: [], sources: [source([])] },
    { year: 2026, importedAt: '2026-10-31T18:17:56Z', rounds: ['1'], missingUfs: [], sources: [source(['13/10/2026 16:46:32 (America/Sao_Paulo)', '13/10/2026 16:47:00 (America/Sao_Paulo)'])] },
  ]);
  // Sem `rounds` (2022), os dois turnos; a data repetida aparece uma vez.
  assert.deepEqual(coverage, {
    '2022': { rounds: ['1', '2'], missingUfs: ['DF'], generated: '29/04/2025' },
    '2026': { rounds: ['1'], missingUfs: [], generated: '13/10/2026' },
  });
  assert.equal(roundNote(coverage, '2022'), null);
  assert.equal(roundNote(coverage, '2026'), 'O arquivo do TSE de 2026 traz só o 1º turno (gerado em 13/10/2026): o outro turno aparece como não disponível, nunca como zero.');
  // Ano sem publicação: nada é presumido.
  assert.equal(roundNote(coverage, '2030'), null);
});
