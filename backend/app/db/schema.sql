-- Esquema de la base de conocimiento. Se aplica con app.db.connection.init_db()
-- y se puede ejecutar varias veces sin romper nada (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS vector;

-- Un documento es una pagina del wiki o un archivo subido por un usuario
CREATE TABLE IF NOT EXISTS documents (
    id          BIGSERIAL PRIMARY KEY,
    source      TEXT        NOT NULL,              -- 'dc_wiki' | 'upload'
    source_id   TEXT        NOT NULL,              -- pageid del wiki o id del archivo
    title       TEXT        NOT NULL,
    url         TEXT,
    metadata    JSONB       NOT NULL DEFAULT '{}', -- tipo, alias, categorias, revid...
    uploaded_by TEXT,                              -- usuario de Keycloak (solo cargas)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_id)
);

-- Borrar un documento borra sus chunks (DELETE /documents/{id})
CREATE TABLE IF NOT EXISTS chunks (
    id          BIGSERIAL PRIMARY KEY,
    document_id BIGINT      NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT         NOT NULL,
    section     TEXT,
    content     TEXT        NOT NULL,              -- encabezado + texto (lo que ve el LLM)
    embedding   vector(384) NOT NULL,              -- multilingual-e5-small
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

-- Indice aproximado para busqueda por similitud coseno
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
    ON chunks USING hnsw (embedding vector_cosine_ops);
