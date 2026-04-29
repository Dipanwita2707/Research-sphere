-- Optimize admin events/statistics query patterns
-- 1) Event admin listing and date-range ordering
CREATE INDEX IF NOT EXISTS "event_createdAt_status_idx"
ON "Event"("createdAt" DESC, "status");

-- 2) Event statistics: top scanners and gate flow aggregation
CREATE INDEX IF NOT EXISTS "event_entry_eventId_volunteerId_entryType_idx"
ON "EventEntry"("eventId", "volunteerId", "entryType");

-- 3) Event registration dashboards with status + recency
CREATE INDEX IF NOT EXISTS "event_registration_eventId_status_registeredAt_idx"
ON "EventRegistration"("eventId", "status", "registeredAt" DESC);
