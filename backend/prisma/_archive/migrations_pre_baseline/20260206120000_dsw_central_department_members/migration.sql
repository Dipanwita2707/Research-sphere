-- DSW and Central Team as central department with multiple members (any one can approve).
-- Drop unique on role_key so multiple users can share the same role (e.g. DSW members).
DROP INDEX IF EXISTS "noting_authority_role_key_key";

-- Ensure unique (role_key, user_id) to avoid duplicate member entries.
CREATE UNIQUE INDEX "noting_authority_role_key_user_id_key" ON "noting_authority"("role_key", "user_id");

-- Track current step in flow when holder is a group (currentHolderId null).
ALTER TABLE "note" ADD COLUMN IF NOT EXISTS "current_flow_index" INTEGER;
