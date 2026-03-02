-- ======================================================================
-- Noting Module Performance Indexes
-- Run this after deploying the performance optimizations.
-- ======================================================================

-- 1. pg_trgm GIN indexes for case-insensitive LIKE/ILIKE search
--    Used by searchEmployees (6 OR branches with contains + mode: insensitive)
--    and list handler search (notingId ILIKE, description ILIKE).
--    Requires pg_trgm extension (usually already enabled on managed PG).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Employee search: uid, email, displayName, firstName, lastName, empId
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_login_uid_trgm
  ON user_login USING gin (uid gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_login_email_trgm
  ON user_login USING gin (email gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_display_name_trgm
  ON employee_details USING gin (display_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_first_name_trgm
  ON employee_details USING gin (first_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_last_name_trgm
  ON employee_details USING gin (last_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_emp_id_trgm
  ON employee_details USING gin (emp_id gin_trgm_ops);

-- 2. Note search: notingId and description ILIKE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_noting_id_trgm
  ON note USING gin (noting_id gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_description_trgm
  ON note USING gin (description gin_trgm_ops);

-- 3. Note copy composite index for getMyCopies performance
--    (assigned_to_id, created_at DESC) — covers the WHERE + ORDER BY in one scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_copy_assigned_created
  ON note_copy (assigned_to_id, created_at DESC);

-- 4. Note history composite index for handled-tab count query
--    Covers: WHERE performed_by_id = ? AND action IN (...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_history_performer_action
  ON note_history (performed_by_id, action);

-- 5. Reporting structure lookup used by recommend handler
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reporting_structure_user_active
  ON reporting_structure (user_id) WHERE is_active = true;
