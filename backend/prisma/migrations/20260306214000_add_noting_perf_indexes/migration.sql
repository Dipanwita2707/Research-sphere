-- Migration: Add indexes to speed up noting list and copy endpoints
-- Targets slow paths:
--   GET /noting?filter=mine&page=...&includeCount
--   GET /noting/my-copies?page=...&limit=...

CREATE INDEX IF NOT EXISTS "note_created_by_updated_at_idx"
  ON "note" ("created_by_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "note_current_holder_status_updated_at_idx"
  ON "note" ("current_holder_id", "status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "note_history_performed_by_action_note_id_idx"
  ON "note_history" ("performed_by_id", "action", "note_id");

CREATE INDEX IF NOT EXISTS "note_copy_assigned_to_created_at_idx"
  ON "note_copy" ("assigned_to_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "note_copy_note_root_created_at_idx"
  ON "note_copy" ("note_id", "root_copy_id", "created_at" ASC);

CREATE INDEX IF NOT EXISTS "reporting_structure_user_active_idx"
  ON "reporting_structure" ("user_id", "is_active");
