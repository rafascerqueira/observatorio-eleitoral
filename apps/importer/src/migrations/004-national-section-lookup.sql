-- Seção antes de zona/local: concentra as poucas unidades de uma busca só
-- por seção e reduz leituras de folhas sob carga de disco. Sem mudar votos.
CREATE INDEX IF NOT EXISTS national_section_lookup
  ON national_section_votes(batch_id,year,office,uf,municipality_code,round,section,zone,polling_place_code);
