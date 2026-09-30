-- ============================================================
-- Migration: rename_vice_chairperson_to_chairperson
-- Renames all vice_chairperson references to chairperson
-- in the club, note tables, and the change-type enum.
-- ============================================================

-- 1. Rename column in "club" table
ALTER TABLE "club" RENAME COLUMN "vice_chairperson_id" TO "chairperson_id";

-- 2. Rename the index on that column
DROP INDEX IF EXISTS "club_viceChairpersonId_idx";
CREATE INDEX "club_chairpersonId_idx" ON "club"("chairperson_id");

-- 3. Rename column in "note" table
ALTER TABLE "note" RENAME COLUMN "club_vice_chairperson_id" TO "club_chairperson_id";

-- 4. Rename the enum value in club_change_type_enum
--    PostgreSQL 10+ supports ALTER TYPE ... RENAME VALUE
ALTER TYPE "club_change_type_enum" RENAME VALUE 'vice_chairperson_change' TO 'chairperson_change';
