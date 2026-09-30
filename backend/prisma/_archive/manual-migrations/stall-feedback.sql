-- ============================================================
-- Migration: stall_feedback table
-- Description: Stores per-stall feedback submitted via QR codes
-- ============================================================

CREATE TABLE IF NOT EXISTS stall_feedback (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          TEXT        NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  stall_id          VARCHAR(16) NOT NULL REFERENCES stall(stall_id) ON DELETE CASCADE,
  points            JSONB       NOT NULL,
  short_description TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stall_feedback_event_id_idx  ON stall_feedback(event_id);
CREATE INDEX IF NOT EXISTS stall_feedback_stall_id_idx  ON stall_feedback(stall_id);
CREATE INDEX IF NOT EXISTS stall_feedback_created_at_idx ON stall_feedback(created_at);

-- Optionally backfill stallQrCode for existing stalls that still have the old /feedback/stall/{stallId} path
-- UPDATE stall SET stall_qr_code = CONCAT('/events/', event_id, '/stalls/', stall_id, '/feedback')
-- WHERE stall_qr_code LIKE '/feedback/stall/%';
