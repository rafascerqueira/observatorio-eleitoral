-- Indicadores do Censo 2022 pela idade de voto (`census-indicators-2022-v1`), um registro por município IBGE; UF e Brasil são
-- somas de numeradores e denominadores destes registros. `result` segue `censusIndicatorsSchema` dos contratos.
CREATE TABLE IF NOT EXISTS census_indicators (
  batch_id text NOT NULL REFERENCES import_batches(id), ibge_code text NOT NULL, uf text NOT NULL, code text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY (batch_id, ibge_code)
);
CREATE INDEX IF NOT EXISTS census_indicators_uf ON census_indicators (batch_id, uf);
