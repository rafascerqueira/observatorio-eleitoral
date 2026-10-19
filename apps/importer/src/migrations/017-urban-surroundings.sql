-- Entorno dos domicílios (Censo 2022): moradores por característica da face de quadra, nas 35 contagens V05200–V05234 na ordem
-- de `URBAN_CHARACTERISTICS`. Município: arquivo municipal do IBGE (inclui setores omitidos). Setor: só os associados a locais de
-- votação que estão na pesquisa; `counts` nulo = setor omitido pelo IBGE ("X"), nunca zero. Setor ausente = fora da pesquisa.
CREATE TABLE IF NOT EXISTS municipality_urban_surroundings (
  batch_id text NOT NULL REFERENCES import_batches(id), ibge_code text NOT NULL, uf text NOT NULL, code text NOT NULL, name text NOT NULL,
  tracts integer NOT NULL, suppressed_tracts integer NOT NULL, counts integer[] NOT NULL, PRIMARY KEY (batch_id, ibge_code)
);
CREATE INDEX IF NOT EXISTS municipality_urban_surroundings_uf ON municipality_urban_surroundings (batch_id, uf);
CREATE TABLE IF NOT EXISTS tract_urban_surroundings (
  batch_id text NOT NULL REFERENCES import_batches(id), cd_setor text NOT NULL, counts integer[], PRIMARY KEY (batch_id, cd_setor)
);
