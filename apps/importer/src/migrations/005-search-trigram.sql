-- Busca de municípios por trigramas: sugestões enquanto se digita e listagem por trecho do nome.
-- `search_name` já é normalizado pelo importador (minúsculas, sem acentos); não altera nenhum resultado publicado.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS municipality_results_search_trgm ON municipality_results USING gin (search_name gin_trgm_ops);
