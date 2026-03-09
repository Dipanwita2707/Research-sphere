-- MANUAL FIX: Add missing columns to gate_pass table
-- Run this in your database client (pgAdmin, DBeaver, Neon Console, etc.)

-- 1. Add visitor_relation column
ALTER TABLE "gate_pass" ADD COLUMN IF NOT EXISTS "visitor_relation" VARCHAR(100);

-- 2. Add verification_code column (if missing)
ALTER TABLE "gate_pass" ADD COLUMN IF NOT EXISTS "verification_code" VARCHAR(10);

-- 3. Add stay_required column
ALTER TABLE "gate_pass" ADD COLUMN IF NOT EXISTS "stay_required" BOOLEAN DEFAULT false;

-- 4. Make optional fields nullable (if they were required before)
ALTER TABLE "gate_pass" ALTER COLUMN "id_proof_type" DROP NOT NULL;
ALTER TABLE "gate_pass" ALTER COLUMN "id_proof_number" DROP NOT NULL;
ALTER TABLE "gate_pass" ALTER COLUMN "department_to_visit" DROP NOT NULL;
ALTER TABLE "gate_pass" ALTER COLUMN "person_to_meet_name" DROP NOT NULL;

-- 5. Add 'personal' value to visit_purpose_enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'personal' AND enumtypid = 'visit_purpose_enum'::regtype) THEN
        ALTER TYPE "visit_purpose_enum" ADD VALUE 'personal';
    END IF;
END $$;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'gate_pass' 
ORDER BY ordinal_position;
