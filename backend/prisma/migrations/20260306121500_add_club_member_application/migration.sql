-- Migration: Add club member application workflow
-- Adds status enum and application table for student -> club application lifecycle.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'club_member_application_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "club_member_application_status" AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "club_member_application" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "club_id" UUID NOT NULL,
  "applicant_id" UUID NOT NULL,
  "applicant_name" VARCHAR(256) NOT NULL,
  "email" CITEXT,
  "mobile_number" VARCHAR(20),
  "program" VARCHAR(128),
  "course" VARCHAR(128),
  "status" "club_member_application_status" NOT NULL DEFAULT 'pending',
  "review_note" VARCHAR(500),
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "club_member_application_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "club_member_application_club_status_idx"
  ON "club_member_application"("club_id", "status");

CREATE INDEX IF NOT EXISTS "club_member_application_applicant_idx"
  ON "club_member_application"("applicant_id");

CREATE INDEX IF NOT EXISTS "club_member_application_created_at_idx"
  ON "club_member_application"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'club_member_application_club_id_fkey'
      AND table_name = 'club_member_application'
  ) THEN
    ALTER TABLE "club_member_application"
      ADD CONSTRAINT "club_member_application_club_id_fkey"
      FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'club_member_application_applicant_id_fkey'
      AND table_name = 'club_member_application'
  ) THEN
    ALTER TABLE "club_member_application"
      ADD CONSTRAINT "club_member_application_applicant_id_fkey"
      FOREIGN KEY ("applicant_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'club_member_application_reviewed_by_id_fkey'
      AND table_name = 'club_member_application'
  ) THEN
    ALTER TABLE "club_member_application"
      ADD CONSTRAINT "club_member_application_reviewed_by_id_fkey"
      FOREIGN KEY ("reviewed_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
