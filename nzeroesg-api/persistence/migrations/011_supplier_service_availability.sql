CREATE TABLE IF NOT EXISTS supplier_service_lanes (
    lane_id UUID PRIMARY KEY,
    workspace_id VARCHAR(80) NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    origin VARCHAR(180) NOT NULL,
    destination VARCHAR(180) NOT NULL,
    transport_method VARCHAR(40) NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km > 0),
    estimated_cost_per_kg DOUBLE PRECISION CHECK (estimated_cost_per_kg > 0),
    cost_currency VARCHAR(3),
    bidirectional BOOLEAN NOT NULL DEFAULT FALSE,
    source_label VARCHAR(160) NOT NULL,
    reference_shipment_id VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workspace_id, supplier_id, origin, destination, transport_method)
);

CREATE INDEX IF NOT EXISTS supplier_service_lanes_workspace_idx
    ON supplier_service_lanes (workspace_id, origin, destination);
