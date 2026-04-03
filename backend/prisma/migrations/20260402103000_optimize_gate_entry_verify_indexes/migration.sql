-- Optimize gate-entry verify/search query paths
CREATE INDEX IF NOT EXISTS "gate_pass_vehicle_number_idx" ON "gate_pass" ("vehicle_number");
CREATE INDEX IF NOT EXISTS "gate_pass_updated_at_idx" ON "gate_pass" ("updated_at" DESC);
