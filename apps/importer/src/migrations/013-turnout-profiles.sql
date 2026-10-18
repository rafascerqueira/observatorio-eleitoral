-- Comparecimento por perfil (TSE) cruzado por gênero × faixa etária × escolaridade, um registro por UF e turno.
CREATE TABLE IF NOT EXISTS turnout_profiles (
  batch_id text NOT NULL REFERENCES import_batches(id), uf text NOT NULL, round integer NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY (batch_id, uf, round)
);
