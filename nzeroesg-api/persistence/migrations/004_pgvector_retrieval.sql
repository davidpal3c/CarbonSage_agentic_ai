CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE evidence_chunks
    ADD CONSTRAINT evidence_chunks_workspace_chunk_unique
    UNIQUE (workspace_id, chunk_id);

CREATE TABLE evidence_chunk_embeddings (
    embedding_id UUID PRIMARY KEY,
    workspace_id VARCHAR(80) NOT NULL,
    chunk_id UUID NOT NULL,
    provider VARCHAR(80) NOT NULL,
    model VARCHAR(160) NOT NULL,
    dimensions INTEGER NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (chunk_id, provider, model),
    FOREIGN KEY (workspace_id, chunk_id)
        REFERENCES evidence_chunks(workspace_id, chunk_id) ON DELETE CASCADE,
    CONSTRAINT evidence_chunk_embeddings_dimensions CHECK (dimensions = 1536)
);

CREATE INDEX evidence_chunk_embeddings_lookup_idx
    ON evidence_chunk_embeddings (workspace_id, provider, model);
