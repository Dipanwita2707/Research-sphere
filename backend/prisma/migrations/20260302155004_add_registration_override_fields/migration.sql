-- Migration: Add autoClosed and manuallyOverridden to event_visibility
-- This supports the dual-control registration logic:
--   autoClosed = true  → system auto-closed because registrationEndDate passed
--   manuallyOverridden = true → admin has manually toggled after date expiry (override active)

ALTER TABLE "event_visibility"
  ADD COLUMN IF NOT EXISTS "auto_closed" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "manually_overridden" BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient auto-close queries
CREATE INDEX IF NOT EXISTS "event_visibility_auto_closed_idx" ON "event_visibility"("auto_closed");
