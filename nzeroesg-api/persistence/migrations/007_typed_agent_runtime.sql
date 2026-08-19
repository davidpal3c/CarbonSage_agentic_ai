CREATE TABLE agent_conversations (
    conversation_id UUID PRIMARY KEY,
    workspace_id VARCHAR(80) NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    policy_version VARCHAR(20) NOT NULL,
    created_by VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (workspace_id, conversation_id),
    CONSTRAINT agent_conversations_status CHECK (status IN ('active', 'closed')),
    CONSTRAINT agent_conversations_title_present CHECK (length(btrim(title)) > 0),
    CONSTRAINT agent_conversations_expiry CHECK (expires_at > created_at)
);

CREATE INDEX agent_conversations_workspace_active_idx
    ON agent_conversations (workspace_id, updated_at DESC)
    WHERE status = 'active';

CREATE INDEX agent_conversations_expiry_idx
    ON agent_conversations (expires_at);

CREATE TABLE agent_messages (
    message_id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    workspace_id VARCHAR(80) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    response JSONB,
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id, conversation_id)
        REFERENCES agent_conversations(workspace_id, conversation_id) ON DELETE CASCADE,
    UNIQUE (workspace_id, message_id),
    UNIQUE (workspace_id, conversation_id, sequence_number),
    CONSTRAINT agent_messages_role CHECK (role IN ('user', 'assistant')),
    CONSTRAINT agent_messages_content_present CHECK (length(btrim(content)) > 0),
    CONSTRAINT agent_messages_sequence_positive CHECK (sequence_number > 0),
    CONSTRAINT agent_messages_response_shape CHECK (
        (role = 'user' AND response IS NULL)
        OR (role = 'assistant' AND response IS NOT NULL)
    )
);

CREATE INDEX agent_messages_conversation_idx
    ON agent_messages (workspace_id, conversation_id, sequence_number);

CREATE TABLE agent_citations (
    citation_id UUID PRIMARY KEY,
    response_message_id UUID NOT NULL,
    workspace_id VARCHAR(80) NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    document_sha256 CHAR(64) NOT NULL,
    page_number INTEGER,
    chunk_index INTEGER NOT NULL,
    excerpt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id, artifact_id)
        REFERENCES artifacts(workspace_id, artifact_id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id, response_message_id)
        REFERENCES agent_messages(workspace_id, message_id) ON DELETE CASCADE,
    CONSTRAINT agent_citations_page_positive CHECK (page_number IS NULL OR page_number > 0),
    CONSTRAINT agent_citations_chunk_nonnegative CHECK (chunk_index >= 0),
    CONSTRAINT agent_citations_excerpt_present CHECK (length(btrim(excerpt)) > 0)
);

CREATE INDEX agent_citations_message_idx
    ON agent_citations (response_message_id, citation_id);

CREATE TABLE agent_tool_events (
    event_id UUID PRIMARY KEY,
    response_message_id UUID NOT NULL,
    workspace_id VARCHAR(80) NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    tool_name VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL,
    duration_ms INTEGER NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    artifact_ids UUID[] NOT NULL DEFAULT '{}',
    error_code VARCHAR(80),
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id, response_message_id)
        REFERENCES agent_messages(workspace_id, message_id) ON DELETE CASCADE,
    CONSTRAINT agent_tool_events_status CHECK (status IN ('succeeded', 'failed')),
    CONSTRAINT agent_tool_events_duration_nonnegative CHECK (duration_ms >= 0),
    CONSTRAINT agent_tool_events_result_nonnegative CHECK (result_count >= 0),
    CONSTRAINT agent_tool_events_sequence_positive CHECK (sequence_number > 0),
    UNIQUE (response_message_id, sequence_number)
);

CREATE INDEX agent_tool_events_message_idx
    ON agent_tool_events (response_message_id, sequence_number);
