-- Migration: Extra Pass / Guest Pass support for event registrations
-- Adds per-event controls, registration counters, entry quantity, and guest rows.

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "allowExtraPasses" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "maxExtraPassesPerUser" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EventRegistration"
  ADD COLUMN IF NOT EXISTS "extraPassCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalAllowedEntries" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "checkedInCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EventEntry"
  ADD COLUMN IF NOT EXISTS "entryCount" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "EventExtraPass" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestEmail" TEXT NOT NULL,
  "mobileNumber" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventExtraPass_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventExtraPass_eventId_idx" ON "EventExtraPass"("eventId");
CREATE INDEX IF NOT EXISTS "EventExtraPass_registrationId_idx" ON "EventExtraPass"("registrationId");
CREATE INDEX IF NOT EXISTS "EventExtraPass_createdById_idx" ON "EventExtraPass"("createdById");
CREATE INDEX IF NOT EXISTS "event_extra_pass_eventId_registrationId_idx" ON "EventExtraPass"("eventId", "registrationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EventExtraPass_eventId_fkey'
      AND table_name = 'EventExtraPass'
  ) THEN
    ALTER TABLE "EventExtraPass"
      ADD CONSTRAINT "EventExtraPass_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EventExtraPass_registrationId_fkey'
      AND table_name = 'EventExtraPass'
  ) THEN
    ALTER TABLE "EventExtraPass"
      ADD CONSTRAINT "EventExtraPass_registrationId_fkey"
      FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EventExtraPass_createdById_fkey'
      AND table_name = 'EventExtraPass'
  ) THEN
    ALTER TABLE "EventExtraPass"
      ADD CONSTRAINT "EventExtraPass_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
