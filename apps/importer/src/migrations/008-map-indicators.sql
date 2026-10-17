-- Indicadores do mapa derivados do contexto publicado (sem dado novo): numerador = soma das categorias indicadas, nulo se
-- alguma for nula; denominador = total da distribuição. Idempotente; o importador do contexto reaplica após gravar.
CREATE TABLE IF NOT EXISTS municipality_indicators (
  batch_id text NOT NULL REFERENCES import_batches(id), uf text NOT NULL, code text NOT NULL, ibge_code text NOT NULL, name text NOT NULL,
  indicator text NOT NULL, numerator bigint, denominator bigint, PRIMARY KEY (batch_id, indicator, uf, code)
);
INSERT INTO municipality_indicators
SELECT m.batch_id, m.uf, m.code, m.ibge_code, m.result->>'name', d.indicator,
  (SELECT CASE WHEN bool_or(c->>'value' IS NULL) OR count(*) <> cardinality(d.keys) THEN NULL ELSE sum((c->>'value')::bigint) END
     FROM jsonb_array_elements(m.result->d.field->'categories') c WHERE c->>'key' = ANY(d.keys)),
  (m.result->d.field->>'total')::bigint
FROM municipality_context m
CROSS JOIN (VALUES ('income-upto-half-mw', 'incomeClasses', ARRAY['none', 'upto-1/4', '1/4-1/2']), ('college-18', 'education18', ARRAY['college-complete']), ('literacy-15', 'literacy15', ARRAY['literate'])) AS d(indicator, field, keys)
ON CONFLICT DO NOTHING;
