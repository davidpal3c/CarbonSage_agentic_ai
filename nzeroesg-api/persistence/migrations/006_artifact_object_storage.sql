CREATE TABLE artifact_objects (
    artifact_id UUID PRIMARY KEY,
    workspace_id VARCHAR(80) NOT NULL,
    provider VARCHAR(30) NOT NULL,
    bucket VARCHAR(255) NOT NULL,
    object_key VARCHAR(1024) NOT NULL UNIQUE,
    size_bytes BIGINT NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    media_type VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    etag VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stored_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT artifact_objects_provider CHECK (provider = 'aws_s3'),
    CONSTRAINT artifact_objects_status CHECK (
        status IN ('reserved', 'ready', 'delete_pending', 'deleted', 'failed')
    ),
    CONSTRAINT artifact_objects_size_positive CHECK (size_bytes > 0)
);

CREATE INDEX artifact_objects_workspace_status_idx
    ON artifact_objects (workspace_id, status, expires_at);

CREATE INDEX artifact_objects_cleanup_idx
    ON artifact_objects (status, expires_at)
    WHERE status IN ('ready', 'delete_pending');

CREATE TABLE artifact_storage_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
    active_bytes BIGINT NOT NULL DEFAULT 0,
    reserved_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT artifact_storage_state_singleton CHECK (singleton),
    CONSTRAINT artifact_storage_active_nonnegative CHECK (active_bytes >= 0),
    CONSTRAINT artifact_storage_reserved_nonnegative CHECK (reserved_bytes >= 0)
);

INSERT INTO artifact_storage_state (singleton) VALUES (TRUE);

CREATE TABLE artifact_storage_monthly_usage (
    period_start DATE PRIMARY KEY,
    write_requests BIGINT NOT NULL DEFAULT 0,
    read_requests BIGINT NOT NULL DEFAULT 0,
    egress_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT artifact_storage_period_is_month_start CHECK (
        period_start = date_trunc('month', period_start)::date
    ),
    CONSTRAINT artifact_storage_writes_nonnegative CHECK (write_requests >= 0),
    CONSTRAINT artifact_storage_reads_nonnegative CHECK (read_requests >= 0),
    CONSTRAINT artifact_storage_egress_nonnegative CHECK (egress_bytes >= 0)
);
