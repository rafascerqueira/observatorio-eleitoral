-- Comparecimento por perfil v2: células gênero × grupo etário × escolaridade × estado civil em vetor int4 (grupos de 7 inteiros:
-- índices das categorias na ordem da publicação + aptos, comparecimento, abstenção). `municipality_code` vazio = a UF inteira.
CREATE TABLE IF NOT EXISTS turnout_profile_cells (
  batch_id text NOT NULL REFERENCES import_batches(id), uf text NOT NULL, municipality_code text NOT NULL, round integer NOT NULL,
  cells integer[] NOT NULL, results_eligible bigint NOT NULL, PRIMARY KEY (batch_id, uf, municipality_code, round)
);
