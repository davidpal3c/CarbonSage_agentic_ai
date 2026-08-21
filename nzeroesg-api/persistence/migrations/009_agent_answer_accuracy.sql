ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS shipments_workspace_supplier_idx
ON shipments (workspace_id, supplier_name)
WHERE supplier_name IS NOT NULL;

UPDATE workspace_quotas
SET quota_limit = 15
WHERE quota_key = 'assistant_requests_per_day'
  AND quota_limit < 15;

CREATE TABLE IF NOT EXISTS agent_daily_usage (
    workspace_id VARCHAR(80) NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    model_calls INTEGER NOT NULL DEFAULT 0,
    provider_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, usage_date),
    CONSTRAINT agent_daily_usage_calls_nonnegative CHECK (model_calls >= 0),
    CONSTRAINT agent_daily_usage_provider_cost_nonnegative CHECK (provider_cost_usd >= 0),
    CONSTRAINT agent_daily_usage_estimated_cost_nonnegative CHECK (estimated_cost_usd >= 0)
);

CREATE INDEX IF NOT EXISTS agent_daily_usage_date_idx
ON agent_daily_usage (usage_date);
