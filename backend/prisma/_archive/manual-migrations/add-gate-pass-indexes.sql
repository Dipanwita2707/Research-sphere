-- Add indexes to gate_pass table for better query performance
-- These indexes will speed up filtering, searching, and sorting operations

-- Index on pass_status (most common filter)
CREATE INDEX IF NOT EXISTS idx_gate_pass_pass_status ON gate_pass(pass_status);

-- Index on qr_status
CREATE INDEX IF NOT EXISTS idx_gate_pass_qr_status ON gate_pass(qr_status);

-- Index on created_by_id (for filtering user's own passes)
CREATE INDEX IF NOT EXISTS idx_gate_pass_created_by_id ON gate_pass(created_by_id);

-- Composite index on visit_date and pass_status (for date filters with status)
CREATE INDEX IF NOT EXISTS idx_gate_pass_visit_date_status ON gate_pass(visit_date, pass_status);

-- Index on visit_end_date (for expiry checks)
CREATE INDEX IF NOT EXISTS idx_gate_pass_visit_end_date ON gate_pass(visit_end_date);

-- Index on mobile_number (for search and duplicate checks)
CREATE INDEX IF NOT EXISTS idx_gate_pass_mobile_number ON gate_pass(mobile_number);

-- Index on visitor_name (for search) using text pattern matching
CREATE INDEX IF NOT EXISTS idx_gate_pass_visitor_name ON gate_pass(visitor_name);

-- Index on pass_id (for quick pass lookup)
CREATE INDEX IF NOT EXISTS idx_gate_pass_pass_id ON gate_pass(pass_id);

-- Index on created_at (for sorting recent passes)
CREATE INDEX IF NOT EXISTS idx_gate_pass_created_at ON gate_pass(created_at DESC);

-- Index on vehicle_number (for search)
CREATE INDEX IF NOT EXISTS idx_gate_pass_vehicle_number ON gate_pass(vehicle_number);

-- Composite index for expiry job (visit_date + pass_status)
CREATE INDEX IF NOT EXISTS idx_gate_pass_expiry_check ON gate_pass(visit_date, visit_end_date, pass_status) WHERE pass_status NOT IN ('checked_out', 'cancelled', 'expired');

-- Display indexes created
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'gate_pass'
    AND indexname LIKE 'idx_gate_pass_%'
ORDER BY indexname;
