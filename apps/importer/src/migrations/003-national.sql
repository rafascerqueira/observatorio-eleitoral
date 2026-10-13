-- Novas tabelas: o piloto e sua publicação permanecem intactos.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid='municipality_results'::regclass
    AND c.contype='p' AND pg_get_constraintdef(c.oid) LIKE '%office, uf, code%'
  ) THEN
    ALTER TABLE municipality_results DROP CONSTRAINT municipality_results_pkey;
    ALTER TABLE municipality_results ADD PRIMARY KEY(batch_id,year,round,office,uf,code);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS original_sources (
  sha256 text NOT NULL, file text NOT NULL, size_bytes bigint NOT NULL,
  PRIMARY KEY (sha256, file)
);
CREATE TABLE IF NOT EXISTS import_coverage (
  batch_id text NOT NULL REFERENCES import_batches(id), year integer NOT NULL,
  office text NOT NULL, uf text NOT NULL, code text NOT NULL, name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','reconciled','blocked','excluded')),
  reason text, section_rows integer NOT NULL DEFAULT 0, metadata_conflicts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (batch_id, year, office, uf, code)
);
CREATE TABLE IF NOT EXISTS national_section_votes (
  batch_id text NOT NULL REFERENCES import_batches(id), year integer NOT NULL,
  election_code text NOT NULL, round integer NOT NULL CHECK (round IN (1,2)),
  office text NOT NULL, uf text NOT NULL, municipality_code text NOT NULL,
  zone integer NOT NULL CHECK(zone>0), section integer NOT NULL CHECK(section>0),
  polling_place_code text NOT NULL, vote_number text NOT NULL,
  votes integer NOT NULL CHECK(votes>=0),
  PRIMARY KEY (batch_id,year,election_code,round,office,uf,municipality_code,zone,section,vote_number)
);
CREATE INDEX IF NOT EXISTS national_section_place ON national_section_votes(batch_id,year,office,uf,municipality_code,round,zone,polling_place_code,section);
CREATE TABLE IF NOT EXISTS national_zone_results (
  batch_id text NOT NULL REFERENCES import_batches(id), year integer NOT NULL,
  office text NOT NULL, uf text NOT NULL, municipality_code text NOT NULL,
  round integer NOT NULL, zone integer NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY(batch_id,year,office,uf,municipality_code,round,zone)
);
CREATE TABLE IF NOT EXISTS national_place_results (
  batch_id text NOT NULL REFERENCES import_batches(id), year integer NOT NULL,
  office text NOT NULL, uf text NOT NULL, municipality_code text NOT NULL,
  round integer NOT NULL, zone integer NOT NULL, code text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY(batch_id,year,office,uf,municipality_code,round,zone,code)
);
