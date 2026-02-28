-- Enable pg_trgm for ILIKE search optimization (avoids full table scans)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for search (contains + insensitive mode)
CREATE INDEX IF NOT EXISTS idx_note_notingid_trgm ON note USING GIN (noting_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_note_description_trgm ON note USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_event_name_trgm ON "Event" USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_event_description_trgm ON "Event" USING GIN (description gin_trgm_ops);
