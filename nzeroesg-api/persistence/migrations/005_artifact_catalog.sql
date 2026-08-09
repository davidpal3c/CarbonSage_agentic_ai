CREATE TABLE artifacts (
    artifact_id UUID PRIMARY KEY,
    workspace_id VARCHAR(80) NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    kind VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL,
    source_type VARCHAR(40) NOT NULL,
    source_reference VARCHAR(500),
    media_type VARCHAR(100),
    content_sha256 CHAR(64),
    version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    UNIQUE (workspace_id, artifact_id),
    CONSTRAINT artifacts_kind CHECK (
        kind IN ('shipment_dataset', 'evidence_document', 'report_snapshot')
    ),
    CONSTRAINT artifacts_status CHECK (status IN ('processing', 'ready', 'failed')),
    CONSTRAINT artifacts_source_type CHECK (
        source_type IN ('local_upload', 'generated', 'google_drive', 'legacy_migration')
    ),
    CONSTRAINT artifacts_version_positive CHECK (version > 0),
    CONSTRAINT artifacts_title_present CHECK (length(btrim(title)) > 0)
);

CREATE INDEX artifacts_workspace_active_idx
    ON artifacts (workspace_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX artifacts_workspace_kind_idx
    ON artifacts (workspace_id, kind, created_at DESC);

ALTER TABLE shipments ADD COLUMN artifact_id UUID;
ALTER TABLE evidence_documents ADD COLUMN artifact_id UUID;

INSERT INTO artifacts (
    artifact_id, workspace_id, kind, title, status, source_type,
    source_reference, media_type, version, metadata, created_by
)
SELECT
    gen_random_uuid(), workspace_id, 'shipment_dataset', 'Existing shipment dataset',
    'ready', 'legacy_migration', 'migration-005', 'text/csv', 1,
    jsonb_build_object('migrated', true), 'migration-005'
FROM shipments
GROUP BY workspace_id;

UPDATE shipments AS shipment
SET artifact_id = artifact.artifact_id
FROM artifacts AS artifact
WHERE artifact.workspace_id = shipment.workspace_id
  AND artifact.kind = 'shipment_dataset'
  AND artifact.source_type = 'legacy_migration';

INSERT INTO artifacts (
    artifact_id, workspace_id, kind, title, status, source_type,
    source_reference, media_type, content_sha256, version, metadata, created_by,
    created_at, updated_at
)
SELECT
    document_id, workspace_id, 'evidence_document', filename, 'ready',
    'legacy_migration', filename, media_type, sha256, 1,
    jsonb_build_object('migrated', true), 'migration-005', created_at, created_at
FROM evidence_documents;

UPDATE evidence_documents SET artifact_id = document_id;

ALTER TABLE shipments ALTER COLUMN artifact_id SET NOT NULL;
ALTER TABLE evidence_documents ALTER COLUMN artifact_id SET NOT NULL;

ALTER TABLE shipments
    ADD CONSTRAINT shipments_workspace_artifact_fk
    FOREIGN KEY (workspace_id, artifact_id)
    REFERENCES artifacts(workspace_id, artifact_id) ON DELETE CASCADE;

ALTER TABLE evidence_documents
    ADD CONSTRAINT evidence_documents_workspace_artifact_fk
    FOREIGN KEY (workspace_id, artifact_id)
    REFERENCES artifacts(workspace_id, artifact_id) ON DELETE CASCADE;

CREATE INDEX shipments_artifact_idx ON shipments (workspace_id, artifact_id);
CREATE INDEX evidence_documents_artifact_idx
    ON evidence_documents (workspace_id, artifact_id);

CREATE TABLE report_snapshots (
    artifact_id UUID PRIMARY KEY REFERENCES artifacts(artifact_id) ON DELETE CASCADE,
    workspace_id VARCHAR(80) NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    schema_version VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    FOREIGN KEY (workspace_id, artifact_id)
        REFERENCES artifacts(workspace_id, artifact_id) ON DELETE CASCADE
);

CREATE INDEX report_snapshots_workspace_idx
    ON report_snapshots (workspace_id, generated_at DESC);
