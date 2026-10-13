import { resolve } from 'node:path';
import { rows, pilot } from './csv';

const root = resolve(__dirname, '../../..');
const sources = [
  ['detalhe_votacao_munzona_2022.zip', 'detalhe_votacao_munzona_2022_BR.csv'],
  ['votacao_candidato_munzona_2022.zip', 'votacao_candidato_munzona_2022_BR.csv'],
  ['votacao_secao_2022_BR.zip', 'votacao_secao_2022_BR.csv'],
];
async function audit() {
  for (const [archive, entry] of sources) {
    if (!archive || !entry) throw new Error('Fonte ausente');
    let read = 0, selected = 0;
    const groups = new Map<string, { rows: number; votes: number }>();
    const generations = new Set<string>();
    for await (const row of rows(resolve(root, 'data/raw/tse/2022', archive), entry)) {
      read++;
      if (!pilot(row)) continue;
      if (++selected <= 2) console.log(entry, JSON.stringify(row));
      generations.add(`${row.DT_GERACAO} ${row.HH_GERACAO}`);
      const key = `${row.NR_TURNO}/${row.ST_VOTO_EM_TRANSITO ?? 'sem-campo'}/${row.CD_ELEICAO}`;
      const group = groups.get(key) ?? { rows: 0, votes: 0 };
      group.rows++;
      group.votes += Number(row.QT_VOTOS ?? row.QT_VOTOS_NOMINAIS ?? 0);
      groups.set(key, group);
    }
    console.log(JSON.stringify({ entry, read, selected, generations: [...generations], groups: Object.fromEntries(groups) }));
  }
}
audit().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
