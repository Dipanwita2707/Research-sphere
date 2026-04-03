ALTER TABLE "reporting_structure"
  ADD COLUMN IF NOT EXISTS "department_scope" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "department_id" UUID;

-- Backfill context from employee primary mappings where possible.
UPDATE "reporting_structure" rs
SET
  "department_scope" = 'school',
  "department_id" = ed."primary_department_id"
FROM "employee_details" ed
WHERE rs."user_id" = ed."user_id"
  AND rs."department_id" IS NULL
  AND ed."primary_department_id" IS NOT NULL;

UPDATE "reporting_structure" rs
SET
  "department_scope" = 'central',
  "department_id" = ed."primary_central_dept_id"
FROM "employee_details" ed
WHERE rs."user_id" = ed."user_id"
  AND rs."department_id" IS NULL
  AND ed."primary_central_dept_id" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reporting_structure_user_id_key'
  ) THEN
    ALTER TABLE "reporting_structure"
      DROP CONSTRAINT "reporting_structure_user_id_key";
  END IF;
END $$;

DROP INDEX IF EXISTS "reporting_structure_user_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "reporting_structure_user_department_unique"
  ON "reporting_structure" ("user_id", "department_scope", "department_id");

CREATE INDEX IF NOT EXISTS "reporting_structure_department_scope_id_idx"
  ON "reporting_structure" ("department_scope", "department_id");

CREATE INDEX IF NOT EXISTS "reporting_structure_user_scope_id_isActive_idx"
  ON "reporting_structure" ("user_id", "department_scope", "department_id", "is_active");

CREATE INDEX IF NOT EXISTS "reporting_structure_manager_scope_id_isActive_idx"
  ON "reporting_structure" ("manager_id", "department_scope", "department_id", "is_active");