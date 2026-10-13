-- Índice para localizar seções sem alterar resultados ou exigir reimportação.
CREATE INDEX IF NOT EXISTS section_votes_lookup
ON section_votes(batch_id, round, municipality_code, section, zone, polling_place_code);
