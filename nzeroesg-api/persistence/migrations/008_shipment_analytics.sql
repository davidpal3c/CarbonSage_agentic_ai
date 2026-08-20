ALTER TABLE shipments ADD COLUMN shipment_date DATE;

CREATE INDEX shipments_workspace_date_idx
    ON shipments (workspace_id, shipment_date, transport_method);
