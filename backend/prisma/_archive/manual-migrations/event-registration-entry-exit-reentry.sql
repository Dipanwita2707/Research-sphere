-- Entry/Exit/Re-entry support for event registrations
-- Adds cumulative exits and inferred student presence flags.

ALTER TABLE "EventRegistration"
ADD COLUMN IF NOT EXISTS "checkedOutCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EventRegistration"
ADD COLUMN IF NOT EXISTS "studentInsideAssumed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill studentInsideAssumed for existing data where someone is currently inside.
UPDATE "EventRegistration"
SET "studentInsideAssumed" = true
WHERE GREATEST(COALESCE("checkedInCount", 0) - COALESCE("checkedOutCount", 0), 0) > 0;
