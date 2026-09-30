-- Finance lookup and listing indexes
CREATE INDEX IF NOT EXISTS "fee_structure_type_batch_year_idx"
  ON "fee_structure" ("type", "batch_year" DESC);

CREATE INDEX IF NOT EXISTS "fee_structure_lookup_idx"
  ON "fee_structure" ("type", "program_id", "specialization_id", "is_active", "batch_year" DESC);

CREATE INDEX IF NOT EXISTS "fee_head_fee_structure_id_idx"
  ON "fee_head" ("fee_structure_id");

CREATE INDEX IF NOT EXISTS "loan_letter_issued_at_idx"
  ON "loan_letter" ("issued_at" DESC);

CREATE INDEX IF NOT EXISTS "loan_letter_program_id_issued_at_idx"
  ON "loan_letter" ("program_id", "issued_at" DESC);

CREATE INDEX IF NOT EXISTS "loan_letter_printed_by_id_issued_at_idx"
  ON "loan_letter" ("printed_by_id", "issued_at" DESC);

-- Prisma cannot express this functional unique index in schema.prisma,
-- so keep it here to prevent environment drift.
CREATE UNIQUE INDEX IF NOT EXISTS "loan_letter_application_number_unique_ci"
  ON "loan_letter" (LOWER("application_number"));
