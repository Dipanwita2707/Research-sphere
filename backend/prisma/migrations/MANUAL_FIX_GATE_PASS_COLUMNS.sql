-- MANUAL FIX: Add missing columns to gate_pass table
-- Run this in your database client (pgAdmin, DBeaver, Neon Console, etc.)

-- 1. Add visitor_relation column
ALTER TABLE "gate_pass" ADD COLUMN IF NOT EXISTS "visitor_relation" VARCHAR(100);

-- 2. Add verification_code column (if missing)
ALTER TABLE "gate_pass" ADD COLUMN IF NOT EXISTS "verification_code" VARCHAR(10);

-- 3. Make optional fields nullable (if they were required before)
ALTER TABLE "gate_pass" ALTER COLUMN "id_proof_type" DROP NOT NULL;
ALTER TABLE "gate_pass" ALTER COLUMN "id_proof_number" DROP NOT NULL;
ALTER TABLE "gate_pass" ALTER COLUMN "department_to_visit" DROP NOT NULL;
ALTER TABLE "gate_pass" ALTER COLUMN "person_to_meet_name" DROP NOT NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'gate_pass' 
ORDER BY ordinal_position;
