ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS freight_cost_value DOUBLE PRECISION
CHECK (freight_cost_value > 0);

ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS freight_cost_currency VARCHAR(3);
