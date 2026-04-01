ALTER TABLE "note"
  ADD COLUMN IF NOT EXISTS "department_id" UUID,
  ADD COLUMN IF NOT EXISTS "department_scope" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "department_name" VARCHAR(256);

CREATE INDEX IF NOT EXISTS "note_department_id_idx"
  ON "note" ("department_id");

CREATE INDEX IF NOT EXISTS "note_department_scope_idx"
  ON "note" ("department_scope");
