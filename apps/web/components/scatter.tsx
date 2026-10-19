/** Ponto da dispersão: `x` e `y` em %, `weight` = denominador da série (dá a área), `detail` = texto da dica. */
export type ScatterPoint = { id: string; name: string; x: number; y: number; weight: number; detail: string };

const pct = (value: number) => `${value.toLocaleString('pt-BR')}%`;
/** Limite do eixo, que sempre começa em zero: múltiplo de 10 até 50 e de 20 acima, sem passar de 100%. */
export function axisMax(values: number[]) {
  const top = Math.max(0, ...values);
  const step = top > 50 ? 20 : 10;
  return Math.min(100, Math.max(step, Math.ceil(top / step) * step));
}
export const axisTicks = (max: number) => { const step = max > 50 ? 20 : 10; return Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step); };
/** Posição em % do eixo com duas casas (0,01% de 600 px é 0,06 px): menos dígitos na página e no payload do servidor. */
const at = (value: number, max: number) => `${Math.round(value / max * 10000) / 100}%`;
const MIN_DIAMETER = 8, MAX_DIAMETER = 28;
/** Diâmetro em px com área proporcional ao peso (raiz do peso), com mínimo de 8 px para o ponto continuar visível. */
export const diameter = (weight: number, maxWeight: number) => maxWeight > 0 ? Math.max(MIN_DIAMETER, Math.sqrt(weight / maxWeight) * MAX_DIAMETER) : MIN_DIAMETER;

/**
 * Dispersão gerada no servidor, em HTML posicionado (como os gráficos de pontos): texto dos eixos legível em qualquer largura e
 * funcionamento sem JavaScript. Uma só série, sem linha de tendência; pontos maiores desenhados primeiro, para os menores ficarem
 * visíveis. Complemento visual: teclado e leitor de tela usam a tabela dos mapas, com os mesmos valores.
 */
export function Scatter({ points, excluded, title, description, xLabel, yLabel, unit }: {
  points: ScatterPoint[]; excluded: number; title: string; description: string; xLabel: string; yLabel: string; unit: string;
}) {
  const xMax = axisMax(points.map((point) => point.x)), yMax = axisMax(points.map((point) => point.y));
  const maxWeight = Math.max(0, ...points.map((point) => point.weight));
  const ordered = [...points].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  return <figure className="scatter-figure">
    <figcaption><span className="choropleth-title">{title}</span><span className="source-note">{description}</span></figcaption>
    <p className="sr-only">Gráfico de dispersão: os valores de cada {unit} estão na tabela dos mapas, abaixo.</p>
    <div className="scatter" aria-hidden="true">
      <p className="scatter-y-title">↑ {yLabel}</p>
      <div className="scatter-body">
        <div className="scatter-y-axis">{axisTicks(yMax).map((tick) => <span key={tick} style={{ bottom: at(tick, yMax) }}>{pct(tick)}</span>)}</div>
        <div className="scatter-plot">
          {axisTicks(xMax).map((tick) => <span key={`x${tick}`} className="scatter-grid is-x" style={{ left: at(tick, xMax) }} />)}
          {axisTicks(yMax).map((tick) => <span key={`y${tick}`} className="scatter-grid is-y" style={{ bottom: at(tick, yMax) }} />)}
          {ordered.map((point) => { const size = Math.round(diameter(point.weight, maxWeight)); return <span key={point.id} className="scatter-dot" data-label={point.name} data-value={point.detail}
            style={{ left: at(point.x, xMax), bottom: at(point.y, yMax), width: size, height: size }} />; })}
        </div>
        <div className="scatter-x-axis">{axisTicks(xMax).map((tick) => <span key={tick} style={{ left: at(tick, xMax) }}>{pct(tick)}</span>)}</div>
      </div>
      <p className="scatter-x-title">{xLabel} →</p>
    </div>
    {excluded > 0 && <p className="query-note choropleth-note">{excluded.toLocaleString('pt-BR')} {excluded === 1 ? `${unit} sem um dos dois valores fica` : `unidades sem um dos dois valores ficam`} fora do gráfico; {excluded === 1 ? 'está' : 'estão'} na tabela.</p>}
  </figure>;
}
