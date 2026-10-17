-- Moradores por faixa fixa de renda do setor (Censo 2022), por município IBGE; Brasil e UF são somas destes registros.
CREATE TABLE IF NOT EXISTS municipality_income_bands (
  batch_id text NOT NULL REFERENCES import_batches(id), ibge_code text NOT NULL, uf text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY (batch_id, ibge_code)
);
CREATE INDEX IF NOT EXISTS municipality_income_bands_uf ON municipality_income_bands (batch_id, uf);
