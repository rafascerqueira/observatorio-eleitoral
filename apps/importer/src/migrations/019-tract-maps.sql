-- Fase B3. Faixa de renda de cada setor (income-bands v3): moradores (V06002) e mediana (V06006) como no arquivo do IBGE.
-- `band`: faixa fixa da mediana; `no-data`: mediana não se aplica ("."); `undisclosed`: setor omitido ("X"), sem moradores nem mediana.
CREATE TABLE IF NOT EXISTS tract_income_bands (
  batch_id text NOT NULL REFERENCES import_batches(id), cd_setor text NOT NULL, ibge_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('band', 'no-data', 'undisclosed')), residents integer, median numeric, band smallint,
  PRIMARY KEY (batch_id, cd_setor)
);
CREATE INDEX IF NOT EXISTS tract_income_bands_municipality ON tract_income_bands (batch_id, ibge_code);

-- Desenho dos setores (tract-display): uma vista por município e, quando o desenho passa do limite, por distrito e subdistrito.
-- Projeção equirretangular com correção de cos(latitude): x = offset_x + (lon − x0)·kx·scale; y = margem + (y1 − lat)·scale.
CREATE TABLE IF NOT EXISTS tract_display_views (
  batch_id text NOT NULL REFERENCES import_batches(id), view_id text NOT NULL, cd_mun text NOT NULL,
  level text NOT NULL CHECK (level IN ('municipality', 'district', 'subdistrict')),
  name text, -- distrito ou subdistrito (NM_DIST/NM_SUBDIST do GeoPackage); nulo na vista do município
  x0 double precision NOT NULL, y1 double precision NOT NULL, kx double precision NOT NULL, scale double precision NOT NULL,
  offset_x double precision NOT NULL, margin double precision NOT NULL, width integer NOT NULL, height integer NOT NULL, tolerance double precision NOT NULL,
  -- split: vista acima do limite dividida em vistas menores (sem caminhos próprios); as demais são servidas.
  tracts integer NOT NULL, svg_bytes integer NOT NULL, gzip_bytes integer NOT NULL, oversize boolean NOT NULL, split boolean NOT NULL,
  PRIMARY KEY (batch_id, view_id)
);
CREATE INDEX IF NOT EXISTS tract_display_views_municipality ON tract_display_views (batch_id, cd_mun);
-- Caminhos SVG já projetados (uma casa decimal), só nas vistas servidas (split = false): cada setor aparece em exatamente uma.
CREATE TABLE IF NOT EXISTS tract_display (
  batch_id text NOT NULL, view_id text NOT NULL, cd_setor text NOT NULL, path text NOT NULL, simplified boolean NOT NULL,
  PRIMARY KEY (batch_id, view_id, cd_setor), FOREIGN KEY (batch_id, view_id) REFERENCES tract_display_views (batch_id, view_id)
);
