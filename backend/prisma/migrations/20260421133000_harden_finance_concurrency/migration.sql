-- Concurrency-safe loan-letter numbering.
CREATE TABLE IF NOT EXISTS "loan_letter_counter" (
  "counter_year" integer PRIMARY KEY,
  "last_value" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Backfill the counter from existing loan-letter numbers so the next generated
-- value cannot collide after deploying the sequence allocator.
INSERT INTO "loan_letter_counter" ("counter_year", "last_value", "updated_at")
SELECT
  CAST(SUBSTRING("unique_number" FROM '^LL-([0-9]{4})-[0-9]+$') AS integer) AS "counter_year",
  MAX(CAST(SUBSTRING("unique_number" FROM '^LL-[0-9]{4}-([0-9]+)$') AS integer)) AS "last_value",
  NOW()
FROM "loan_letter"
WHERE "unique_number" ~ '^LL-[0-9]{4}-[0-9]+$'
GROUP BY CAST(SUBSTRING("unique_number" FROM '^LL-([0-9]{4})-[0-9]+$') AS integer)
ON CONFLICT ("counter_year")
DO UPDATE SET
  "last_value" = GREATEST("loan_letter_counter"."last_value", EXCLUDED."last_value"),
  "updated_at" = NOW();

-- DB-enforced fee-structure uniqueness. These are partial unique indexes because
-- Prisma cannot model the nullable base/specialization split cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS "fee_structure_transport_hostel_unique_idx"
  ON "fee_structure" ("type", "batch_year")
  WHERE "type" IN ('TRANSPORT', 'HOSTEL') AND "program_id" IS NULL AND "specialization_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "fee_structure_academic_base_unique_idx"
  ON "fee_structure" ("program_id", "batch_year")
  WHERE "type" = 'ACADEMIC' AND "specialization_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "fee_structure_academic_specialization_unique_idx"
  ON "fee_structure" ("program_id", "specialization_id", "batch_year")
  WHERE "type" = 'ACADEMIC' AND "specialization_id" IS NOT NULL;

-- Reprint-heavy loan-letter lookups.
CREATE INDEX IF NOT EXISTS "audit_log_actor_target_action_idx"
  ON "audit_log" ("target_table", "action", "actor_id", "target_id");

CREATE INDEX IF NOT EXISTS "audit_log_target_action_created_at_idx"
  ON "audit_log" ("target_table", "target_id", "action", "created_at" DESC);
