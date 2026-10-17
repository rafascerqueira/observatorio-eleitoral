-- Contexto municipal (IBGE, Censo 2022) e perfis do TSE: um registro por município e publicação, com o código IBGE validado.
CREATE TABLE IF NOT EXISTS municipality_context (
  batch_id text NOT NULL REFERENCES import_batches(id), uf text NOT NULL, code text NOT NULL, ibge_code text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY (batch_id, uf, code)
);
CREATE UNIQUE INDEX IF NOT EXISTS municipality_context_ibge ON municipality_context (batch_id, ibge_code);
