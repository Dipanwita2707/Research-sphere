-- Add visitor_relation column to gate_pass table
ALTER TABLE "gate_pass" ADD COLUMN IF NOT EXISTS "visitor_relation" VARCHAR(100);
