-- Sensibilidade da associação local → setor (só renda): grupos de locais refeitos com a faixa predominante entre os moradores
-- dos setores do mesmo município a até `radius` metros do ponto do TSE. Derivada de publicações existentes; não substitui a métrica E.
CREATE TABLE IF NOT EXISTS place_group_sensitivity (
  batch_id text NOT NULL REFERENCES import_batches(id), results_batch text NOT NULL, office text NOT NULL, uf text NOT NULL, round integer NOT NULL,
  radius integer NOT NULL, result jsonb NOT NULL, PRIMARY KEY (batch_id, office, uf, round, radius)
);
