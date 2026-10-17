-- Métrica E pré-calculada por recorte publicado (cargo, UF ou BR, turno) e indicador; derivada de publicações existentes.
CREATE TABLE IF NOT EXISTS place_groups (
  batch_id text NOT NULL REFERENCES import_batches(id), results_batch text NOT NULL, office text NOT NULL, uf text NOT NULL, round integer NOT NULL,
  indicator text NOT NULL, result jsonb NOT NULL, PRIMARY KEY (batch_id, office, uf, round, indicator)
);
