-- Migration: optimize /events/registrations/my endpoint
-- Supports fast pagination by user and batched guest-pass loading

CREATE INDEX IF NOT EXISTS "event_registration_userId_registeredAt_idx"
  ON "event_registration" ("user_id", "registered_at" DESC);

CREATE INDEX IF NOT EXISTS "event_extra_pass_registrationId_createdAt_idx"
  ON "event_extra_pass" ("registration_id", "created_at" ASC);
