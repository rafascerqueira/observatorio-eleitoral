-- Fase D2. Propostas de governo da Presidência (TSE): documentos únicos por SHA-256, candidaturas que os apresentaram e texto por página.
CREATE TABLE IF NOT EXISTS proposal_documents (
  batch_id text NOT NULL REFERENCES import_batches(id), sha256 text NOT NULL, file text NOT NULL, size_bytes integer NOT NULL,
  pages integer NOT NULL, native_pages integer NOT NULL, ocr_pages integer NOT NULL, empty_pages integer NOT NULL,
  PRIMARY KEY (batch_id, sha256)
);
-- listing: candidate (com votos), no-votes (inapta e sem votos, listada à parte), same-document (documento idêntico ao de outra candidatura).
CREATE TABLE IF NOT EXISTS proposal_candidacies (
  batch_id text NOT NULL REFERENCES import_batches(id), sq_candidato text NOT NULL, number text NOT NULL, ballot_name text NOT NULL, party text NOT NULL,
  situation text NOT NULL, listing text NOT NULL CHECK (listing IN ('candidate', 'no-votes', 'same-document')), document_sha256 text,
  PRIMARY KEY (batch_id, sq_candidato)
);
-- method: native (texto do próprio PDF), ocr (Tesseract), empty (nenhum texto em nenhum dos dois). search_text: `searchText` dos contratos.
CREATE TABLE IF NOT EXISTS proposal_pages (
  batch_id text NOT NULL, sha256 text NOT NULL, page integer NOT NULL, method text NOT NULL CHECK (method IN ('native', 'ocr', 'empty')),
  text text NOT NULL, search_text text NOT NULL,
  PRIMARY KEY (batch_id, sha256, page), FOREIGN KEY (batch_id, sha256) REFERENCES proposal_documents (batch_id, sha256)
);
