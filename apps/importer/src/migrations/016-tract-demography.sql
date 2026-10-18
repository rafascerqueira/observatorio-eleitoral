-- Moradores de 15+ por faixa de perfil do setor (Censo 2022, demografia), somados por município; equivalente censitário de /perfis.
CREATE TABLE IF NOT EXISTS municipality_tract_demography (
  batch_id text NOT NULL REFERENCES import_batches(id), ibge_code text NOT NULL, uf text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY (batch_id, ibge_code)
);
CREATE INDEX IF NOT EXISTS municipality_tract_demography_uf ON municipality_tract_demography (batch_id, uf);
