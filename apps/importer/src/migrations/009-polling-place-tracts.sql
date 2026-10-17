-- Fase 3: local de votação → setor censitário (IBGE 2022). A geometria dos setores só existe em tabela temporária durante a
-- associação; ficam a associação de cada local (com status declarado) e o contexto dos setores associados.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS polling_place_tracts (
  batch_id text NOT NULL REFERENCES import_batches(id), uf text NOT NULL, municipality_code text NOT NULL, zone integer NOT NULL, place_code text NOT NULL,
  ibge_code text NOT NULL, name text, latitude double precision, longitude double precision, electors integer NOT NULL,
  -- associated: um único setor contém o ponto e ele é do município esperado. Os demais status não associam (nada é escolhido).
  status text NOT NULL CHECK (status IN ('associated', 'no-coordinate', 'conflicting-coordinates', 'outside-tracts', 'other-municipality', 'ambiguous')),
  -- Outros locais do município, com nome diferente, na mesma coordenada exata (indício de ponto padrão, não de geocodificação).
  shared_coordinate integer NOT NULL DEFAULT 0, cd_setor text,
  PRIMARY KEY (batch_id, uf, municipality_code, zone, place_code)
);
-- relocated: o cadastro (gerado depois da eleição) aponta outro local para alguma seção; a coordenada pode ser do prédio novo.
ALTER TABLE polling_place_tracts DROP CONSTRAINT IF EXISTS polling_place_tracts_status_check;
ALTER TABLE polling_place_tracts ADD CONSTRAINT polling_place_tracts_status_check CHECK (status IN ('associated', 'no-coordinate', 'conflicting-coordinates', 'relocated', 'outside-tracts', 'other-municipality', 'ambiguous'));
CREATE INDEX IF NOT EXISTS polling_place_tracts_setor ON polling_place_tracts (batch_id, cd_setor);
CREATE TABLE IF NOT EXISTS census_tract_context (
  batch_id text NOT NULL REFERENCES import_batches(id), cd_setor text NOT NULL, ibge_code text NOT NULL, situation text,
  population bigint, responsible_with_income bigint, responsible_income_mean numeric, responsible_income_median numeric,
  PRIMARY KEY (batch_id, cd_setor)
);
