-- Perfil do eleitorado por local (cadastro do TSE somado por seção): contagens por dimensão, na ordem declarada na publicação.
CREATE TABLE IF NOT EXISTS polling_place_profiles (
  batch_id text NOT NULL REFERENCES import_batches(id), uf text NOT NULL, municipality_code text NOT NULL, zone integer NOT NULL, place_code text NOT NULL,
  eligible integer NOT NULL, counts jsonb NOT NULL, PRIMARY KEY (batch_id, uf, municipality_code, zone, place_code)
);
