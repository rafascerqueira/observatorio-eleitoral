-- Malhas do IBGE (2022) para mapas: topologias por nível e UF, ligadas aos municípios do TSE pelo código IBGE validado.
CREATE TABLE IF NOT EXISTS map_geometries (
  batch_id text NOT NULL REFERENCES import_batches(id), level text NOT NULL CHECK (level IN ('uf', 'municipality')),
  uf text NOT NULL, topology jsonb NOT NULL, PRIMARY KEY (batch_id, level, uf)
);
