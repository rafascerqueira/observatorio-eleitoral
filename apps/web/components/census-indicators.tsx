import { age15Basis, percent, type CensusIndicators, type CensusShare } from '@observatorio/contracts';
import { DistributionTable } from './municipality-context';

type Distribution = CensusIndicators['distributions'][keyof CensusIndicators['distributions']][string];
const number = (value: number | null) => value === null ? 'Indisponível' : value.toLocaleString('pt-BR');
const rate = (value: number | null) => value === null ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const share = (value: number | null, total: number | null) => value === null || total === null ? null : percent(value, total);
const SLICE_LABEL: Record<string, string> = { '16+': '16 anos ou mais', '15+': '15 anos ou mais', '16-17': '16 e 17 anos', '18-69': '18 a 69 anos', '70+': '70 anos ou mais', '18+': '18 anos ou mais',
  '18-64': '18 a 64 anos', '65+': '65 anos ou mais', '14+': '14 anos ou mais', all: 'Todas as idades' };
const KIND_LABEL = { universo: 'Universo do Censo', amostra: 'Estimativa da amostra' } as const;

/**
 * Uma distribuição em vários recortes de idade da mesma tabela: linhas = categorias, colunas = recortes, cada célula com o
 * percentual e a contagem. Recortes 15+ levam a nota sobre 16+ do tema (limite ou referência, conforme `age15Basis`), nunca estimado.
 */
function SlicesTable({ title, data, slices, unit }: { title: string; data: Record<string, Distribution>; slices: string[]; unit: string }) {
  const columns = slices.map((slice) => ({ slice, item: data[slice]! }));
  const first = columns[0]!.item;
  const undistributed = columns.some((column) => column.item.undistributed);
  return <div className="table-scroll context-table" role="region" aria-label={title} tabIndex={0}><table>
    <caption><span className="context-caption">{title}</span> <span className={`badge kind-badge kind-${first.kind}`}>{KIND_LABEL[first.kind as keyof typeof KIND_LABEL]}</span> <span className="source-note">{first.source}</span></caption>
    <thead><tr><th scope="col">Categoria</th>{columns.map((column) => <th scope="col" key={column.slice}>{SLICE_LABEL[column.slice] ?? column.slice}</th>)}</tr></thead>
    <tbody>{first.categories.map((category, index) => <tr key={category.key}><th scope="row">{category.label}</th>
      {columns.map((column) => { const value = column.item.categories[index]?.value ?? null; return <td key={column.slice}>{rate(share(value, column.item.total))}<span className="source-note"> · {number(value)}</span></td>; })}</tr>)}
      {undistributed && <tr><th scope="row">Diferença não discriminada nas categorias da fonte</th>{columns.map((column) => <td key={column.slice}>{rate(share(column.item.undistributed ?? 0, column.item.total))}<span className="source-note"> · {number(column.item.undistributed ?? 0)}</span></td>)}</tr>}
      <tr className="total-row"><th scope="row">Total ({unit})</th>{columns.map((column) => <td key={column.slice}>{number(column.item.total)}</td>)}</tr></tbody>
  </table>
  {columns.some((column) => column.item.roundingDifference) && <p className="query-note">Estimativas da amostra arredondadas por célula: em algum recorte a soma das categorias difere do total em poucas pessoas, dentro do limite do arredondamento. Nada foi ajustado.</p>}
  {undistributed && <p className="query-note">O total divulgado pela fonte supera a soma das categorias. Essa diferença foi preservada e não foi redistribuída. A causa não está informada nos dados consultados; não se presume omissão, falta de resposta ou erro da fonte.</p>}
  </div>;
}

function ShareRows({ title, rows }: { title: string; rows: Array<{ label: string; share: CensusShare | null; note?: string }> }) {
  const first = rows.find((row) => row.share)?.share;
  return <div className="table-scroll context-table" role="region" aria-label={title} tabIndex={0}><table>
    <caption><span className="context-caption">{title}</span> {first && <span className={`badge kind-badge kind-${first.kind}`}>{KIND_LABEL[first.kind]}</span>} {first && <span className="source-note">{first.source}</span>}</caption>
    <thead><tr><th scope="col">Recorte</th><th scope="col">Pessoas</th><th scope="col">Base</th><th scope="col">%</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>
      {row.share ? <><td>{number(row.share.numerator)}</td><td>{number(row.share.denominator)}</td><td>{rate(share(row.share.numerator, row.share.denominator))}</td></> : <td colSpan={3}>{row.note ?? 'Indisponível'}</td>}</tr>)}</tbody>
  </table></div>;
}

/** Temas do Censo pela idade de voto (publicação `census-indicators-2022-v1`), com base de idade explícita em cada tabela. */
export function CensusSections({ data }: { data: CensusIndicators }) {
  const d = data.distributions;
  const deviation = data.age15.age15 !== null && data.age15.age15plus ? data.age15.age15 / data.age15.age15plus * 100 : null;
  const share15 = deviation === null ? 'indisponível' : `${deviation.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  const points15 = deviation === null ? 'um valor indisponível' : `${deviation.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ponto(s) percentual(is)`;
  // Limite demonstrado só na mesma população da 9606 (ver `age15Basis`); nas outras bases, a proporção é só referência.
  const base15 = (basis: 'bound' | 'reference') => basis === 'bound'
    ? <p className="query-note">Recortes de 15 anos ou mais: a tabela do IBGE agrupa as idades de 15 a 19 anos, então não dá para separar quem tem 16 anos ou mais (a idade mínima para votar). Como a base é a população residente, a mesma da proporção de pessoas de 15 anos, neste município a parcela entre 15+ difere da parcela entre 16+ em no máximo {points15} (pessoas de 15 anos ÷ 15+). Nada é estimado.</p>
    : <p className="query-note">Recortes de 15 anos ou mais: a tabela do IBGE agrupa as idades de 15 a 19 anos, então não dá para separar quem tem 16 anos ou mais (a idade mínima para votar). Na população residente do município, as pessoas de 15 anos são {share15} das de 15 anos ou mais; esta tabela tem outra base (amostra ou moradores em domicílios particulares), com composição por idade que pode ser diferente, então essa proporção é só uma referência, não um limite garantido da diferença entre 15+ e 16+. Nada é estimado.</p>;
  const laborForce = d.laborForce, favela = data.favela;
  return <>
    <details className="context-section"><summary>Cor ou raça (IBGE)</summary>
      <p className="query-note">Pessoas do município pela cor ou raça declarada ao Censo, em idades de voto: 16 e 17 anos e 70 anos ou mais têm voto facultativo; de 18 a 69, obrigatório. Cada categoria aparece separada, e nada aqui indica o voto de um grupo. O cadastro do TSE de 2022 não informa cor ou raça dos eleitores.</p>
      <SlicesTable title="Pessoas por cor ou raça e idade de voto" data={d.race} slices={['16+', '16-17', '18-69', '70+']} unit="pessoas" />
    </details>
    <details className="context-section"><summary>Religião (IBGE)</summary>
      <p className="query-note">Religião declarada ao Censo (estimativa da amostra). Descreve a população do município, não o voto de quem segue cada religião.</p>{base15(age15Basis('religion'))}
      <SlicesTable title="Pessoas por religião" data={d.religion} slices={['15+', '70+']} unit="pessoas" />
    </details>
    <details className="context-section"><summary>Escolaridade e alfabetização pela idade de voto (IBGE)</summary>
      <SlicesTable title="Nível de instrução" data={d.education} slices={['18+', '18-69', '70+']} unit="pessoas" />
      <p className="query-note">Alfabetização (universo do Censo): a tabela tem idade simples até 64 anos e depois só 65 anos ou mais, por isso o último recorte começa aos 65, e não aos 70.</p>
      <SlicesTable title="Pessoas por alfabetização" data={d.literacy} slices={['16+', '16-17', '18-64', '65+']} unit="pessoas" />
    </details>
    <details className="context-section"><summary>Trabalho (IBGE)</summary>
      <p className="query-note">Estimativas da amostra do Censo, na semana de referência. Desocupação = desocupados ÷ força de trabalho; não é comparável à taxa da PNAD Contínua. Onde a tabela não tem idade, a base é a do IBGE: ocupados de 14 anos ou mais.</p>
      <ShareRows title="Desocupação" rows={(['18-69', '70+', '14+'] as const).map((slice) => ({ label: SLICE_LABEL[slice]!, share: { kind: 'amostra', source: laborForce[slice]!.source, numerator: laborForce[slice]!.categories[1]?.value ?? null, denominator: laborForce[slice]!.total } }))} />
      <SlicesTable title="Condição em relação à força de trabalho" data={d.labor} slices={['18-69', '70+', '14+']} unit="pessoas" />
      <DistributionTable title="Ocupados por contribuição para a previdência oficial" data={d.socialSecurity['14+']!} unit="Ocupados" />
      <DistributionTable title="Ocupados por posição na ocupação (“setor público” sem militares nem empresas estatais, como na fonte)" data={d.position['14+']!} unit="Ocupados" />
      <DistributionTable title="Ocupados por seção de atividade" data={d.activity['14+']!} unit="Ocupados" />
      <DistributionTable title="Ocupados por rendimento de todos os trabalhos (salário mínimo de R$ 1.212,00)" data={d.workIncome['14+']!} unit="Ocupados" />
    </details>
    <details className="context-section"><summary>Internet e moradia (IBGE)</summary>
      <p className="query-note">Moradores em domicílios particulares permanentes ocupados (estimativa da amostra). Descreve o domicílio de quem mora no município.</p>{base15(age15Basis('internet'))}
      <SlicesTable title="Conexão domiciliar à internet" data={d.internet} slices={['15+', '70+']} unit="moradores" />
      <SlicesTable title="Condição de ocupação do domicílio" data={d.tenure} slices={['15+', '70+']} unit="moradores" />
      <SlicesTable title="Moradores por cômodo usado como dormitório" data={d.crowding} slices={['15+', '70+']} unit="moradores" />
    </details>
    <details className="context-section"><summary>Saneamento (IBGE)</summary>
      <p className="query-note">Moradores em domicílios particulares permanentes ocupados (universo do Censo).</p>{base15(age15Basis('water'))}
      <DistributionTable title="Abastecimento de água (moradores de 15 anos ou mais)" data={d.water['15+']!} unit="Moradores" />
      <DistributionTable title="Esgotamento sanitário (moradores de 15 anos ou mais)" data={d.sewage['15+']!} unit="Moradores" />
      <DistributionTable title="Banheiro ou sanitário (moradores de 15 anos ou mais)" data={d.bathroom['15+']!} unit="Moradores" />
      <DistributionTable title="Destino do lixo (moradores de 15 anos ou mais)" data={d.garbage['15+']!} unit="Moradores" />
    </details>
    <details className="context-section"><summary>Urbano × rural e favelas (IBGE)</summary>
      <p className="query-note">Situação do domicílio e favelas e comunidades urbanas delimitadas pelo IBGE (universo do Censo).</p>{base15(age15Basis('urbanRural'))}
      <SlicesTable title="Pessoas por situação do domicílio" data={d.urbanRural} slices={['15+', '70+']} unit="pessoas" />
      {favela.status === 'present' && <ShareRows title={`Favelas e comunidades urbanas (${number(favela.favelas)} no município)`} rows={[{ label: SLICE_LABEL['15+']!, share: favela['15+'] }]} />}
      {favela.status === 'not-delimited' && <p className="query-note">Nenhuma favela ou comunidade urbana delimitada pelo IBGE neste município: ele não aparece nas tabelas de favelas, e os setores censitários confirmam (zero conferido).</p>}
      {favela.status === 'divergent' && <p className="notice">{favela.note}</p>}
    </details>
    <details className="context-section"><summary>Pessoas com deficiência (IBGE)</summary>
      <p className="query-note">No Censo 2022, pessoa com deficiência é quem declarou ter muita dificuldade ou não conseguir de modo algum em ao menos um dos tipos abaixo (estimativa da amostra). A parcela cresce muito com a idade.</p>{base15(age15Basis('disability'))}
      <ShareRows title="Pessoas com deficiência" rows={[{ label: SLICE_LABEL['15+']!, share: data.disability['15+'] }, { label: SLICE_LABEL['70+']!, share: data.disability['70+'] }]} />
      <ShareRows title="Por tipo de dificuldade (2 anos ou mais; a tabela não separa por idade; uma pessoa pode ter mais de um tipo)" rows={data.disability.types.map((type) => ({ label: type.label, share: type }))} />
    </details>
    <details className="context-section"><summary>Migração (IBGE)</summary>
      <p className="query-note">Quem mudou de município pode manter o título de eleitor no município anterior, o que ajuda a ler a diferença entre cadastro e população. Estimativas da amostra; a base é a da mesma amostra.</p>{base15(age15Basis('migration'))}
      <ShareRows title="Não moravam no município 5 anos antes" rows={[{ label: SLICE_LABEL['15+']!, share: data.migration['15+'] }, { label: SLICE_LABEL['70+']!, share: data.migration['70+'] }]} />
      <DistributionTable title="Tempo de residência de quem mora há menos de 10 anos no município" data={d.residenceTime.all!} unit="Pessoas" />
    </details>
  </>;
}
