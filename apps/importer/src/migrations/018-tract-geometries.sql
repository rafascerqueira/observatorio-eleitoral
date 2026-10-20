-- Malha de setores do Censo 2022 com a geometria exata (SIRGAS 2000, SRID 4674), uma linha por setor, com as partes descontínuas
-- unidas como na associação local → setor. Validade registrada sem reparo: usos espaciais filtram `valid`.
CREATE TABLE IF NOT EXISTS tract_geometries (
  batch_id text NOT NULL REFERENCES import_batches(id), cd_setor text NOT NULL, cd_mun text NOT NULL, situation text, parts integer NOT NULL,
  valid boolean NOT NULL, invalid_reason text, geom geometry(MultiPolygon, 4674) NOT NULL, PRIMARY KEY (batch_id, cd_setor)
);
CREATE INDEX IF NOT EXISTS tract_geometries_municipality ON tract_geometries (batch_id, cd_mun);
CREATE INDEX IF NOT EXISTS tract_geometries_geom ON tract_geometries USING gist (geom);
