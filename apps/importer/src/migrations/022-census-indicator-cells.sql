-- Células derivadas dos indicadores do Censo publicados (`census_indicators`), sem dado novo: uma linha por município, tema e
-- recorte, com o total (denominador) e as categorias na ordem gravada. Parcelas (deficiência, migração, favelas) entram com a chave
-- `numerator`; `age15` guarda as pessoas de 15 anos (desvio declarado dos recortes 15+). Valores nulos continuam nulos.
-- Idempotente; o importador reaplica depois de publicar. A API lê só o tema e o recorte pedidos (a leitura do JSON inteiro passava de 0,8 s).
CREATE TABLE IF NOT EXISTS census_indicator_cells (
  batch_id text NOT NULL REFERENCES import_batches(id), ibge_code text NOT NULL, uf text NOT NULL, code text NOT NULL, name text NOT NULL,
  theme text NOT NULL, slice text NOT NULL, total bigint, keys text[] NOT NULL, counts bigint[] NOT NULL,
  PRIMARY KEY (batch_id, theme, slice, ibge_code)
);
CREATE INDEX IF NOT EXISTS census_indicator_cells_uf ON census_indicator_cells (batch_id, theme, slice, uf);
INSERT INTO census_indicator_cells
SELECT ci.batch_id, ci.ibge_code, ci.uf, ci.code, ci.result->>'name', t.theme, s.slice, (s.d->>'total')::bigint,
  array_agg(c.item->>'key' ORDER BY c.ord), array_agg((c.item->>'value')::bigint ORDER BY c.ord)
FROM census_indicators ci
CROSS JOIN LATERAL jsonb_each(ci.result->'distributions') t(theme, slices)
CROSS JOIN LATERAL jsonb_each(t.slices) s(slice, d)
CROSS JOIN LATERAL jsonb_array_elements(s.d->'categories') WITH ORDINALITY c(item, ord)
GROUP BY ci.batch_id, ci.ibge_code, ci.uf, ci.code, ci.result->>'name', t.theme, s.slice, s.d->>'total'
ON CONFLICT DO NOTHING;
INSERT INTO census_indicator_cells
SELECT ci.batch_id, ci.ibge_code, ci.uf, ci.code, ci.result->>'name', p.theme, p.slice, (p.share->>'denominator')::bigint, ARRAY['numerator'], ARRAY[(p.share->>'numerator')::bigint]
FROM census_indicators ci
CROSS JOIN LATERAL (VALUES ('disability', '15+', ci.result->'disability'->'15+'), ('disability', '70+', ci.result->'disability'->'70+'),
  ('migration', '15+', ci.result->'migration'->'15+'), ('migration', '70+', ci.result->'migration'->'70+'), ('favela', '15+', ci.result->'favela'->'15+'),
  ('age15', '15+', jsonb_build_object('numerator', ci.result->'age15'->'age15', 'denominator', ci.result->'age15'->'age15plus'))) AS p(theme, slice, share)
ON CONFLICT DO NOTHING;
INSERT INTO census_indicator_cells
SELECT ci.batch_id, ci.ibge_code, ci.uf, ci.code, ci.result->>'name', 'disabilityTypes', '2+', min((c.item->>'denominator')::bigint),
  array_agg(c.item->>'key' ORDER BY c.ord), array_agg((c.item->>'numerator')::bigint ORDER BY c.ord)
FROM census_indicators ci CROSS JOIN LATERAL jsonb_array_elements(ci.result->'disability'->'types') WITH ORDINALITY c(item, ord)
GROUP BY ci.batch_id, ci.ibge_code, ci.uf, ci.code, ci.result->>'name'
ON CONFLICT DO NOTHING;
