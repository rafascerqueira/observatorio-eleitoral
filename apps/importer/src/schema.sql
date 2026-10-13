CREATE TABLE IF NOT EXISTS import_batches (
  id text PRIMARY KEY,
  scope text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS import_batches_active_scope ON import_batches (scope) WHERE published;

CREATE TABLE IF NOT EXISTS municipality_results (
  batch_id text NOT NULL REFERENCES import_batches(id),
  year integer NOT NULL,
  round integer NOT NULL CHECK (round IN (1, 2)),
  office text NOT NULL,
  code text NOT NULL,
  uf text NOT NULL,
  search_name text NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (batch_id, year, round, office, uf, code)
);
CREATE INDEX IF NOT EXISTS municipality_results_filter ON municipality_results(year, round, office, uf);

CREATE TABLE IF NOT EXISTS section_votes (
  batch_id text NOT NULL REFERENCES import_batches(id),
  year integer NOT NULL,
  election_code text NOT NULL,
  round integer NOT NULL CHECK (round IN (1, 2)),
  office text NOT NULL,
  municipality_code text NOT NULL,
  zone integer NOT NULL CHECK (zone > 0),
  section integer NOT NULL CHECK (section > 0),
  polling_place_code text NOT NULL,
  vote_number text NOT NULL,
  votes integer NOT NULL CHECK (votes >= 0),
  PRIMARY KEY (batch_id, year, election_code, round, office, municipality_code, zone, section, vote_number)
);
CREATE INDEX IF NOT EXISTS section_votes_place ON section_votes(batch_id, round, zone, polling_place_code);
CREATE INDEX IF NOT EXISTS section_votes_lookup ON section_votes(batch_id, round, municipality_code, section, zone, polling_place_code);

CREATE TABLE IF NOT EXISTS zone_results (
  batch_id text NOT NULL REFERENCES import_batches(id), round integer NOT NULL, zone integer NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (batch_id, round, zone)
);
CREATE TABLE IF NOT EXISTS polling_place_results (
  batch_id text NOT NULL REFERENCES import_batches(id), round integer NOT NULL, zone integer NOT NULL,
  code text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY (batch_id, round, zone, code)
);
