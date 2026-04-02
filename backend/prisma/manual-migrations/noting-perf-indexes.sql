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

-- ======================================================================
-- NEW INDEXES (v2) — Added for deep optimization pass
-- ======================================================================

-- 6. NotePoint FK index — used by every detail view JOIN on note_point.note_id
--    Without this, Prisma's JOIN strategy does a seq scan on note_point.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_point_noteId
  ON note_point (note_id);

-- 7. NotePoint composite — covers ORDER BY sort_order in detail view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_point_noteId_sortOrder
  ON note_point (note_id, sort_order);

-- 8. NoteAttachment FK index — JOIN on note_attachment.note_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_attachment_noteId
  ON note_attachment (note_id);

-- 9. NoteCopyReply composite — covers ORDER BY created_at in reply loading
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_copy_reply_copyId_createdAt
  ON note_copy_reply (copy_id, created_at);

-- ======================================================================
-- Phase 2: FK & JOIN indexes for note relations
-- These prevent sequential scans when Prisma JOINs points/attachments/replies
-- ======================================================================

-- 6. NotePoint FK index — every detail view does points { orderBy: sortOrder }
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_point_note_id
  ON note_point (note_id);

-- 7. NotePoint composite — covers FK filter + sort in one scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_point_note_id_sort_order
  ON note_point (note_id, sort_order);

-- 8. NoteAttachment FK index — every detail view loads attachments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_attachment_note_id
  ON note_attachment (note_id);

-- 9. NoteCopyReply composite — ordered reply loading per copy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_copy_reply_copy_id_created_at
  ON note_copy_reply (copy_id, created_at);

-- 10. Covering index for list view: status + updatedAt DESC + createdById
--     Covers filter=mine ORDER BY updatedAt DESC without extra index lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_list_mine
  ON note (created_by_id, updated_at DESC) WHERE status != 'draft';

-- 11. Covering index for pending filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_list_pending
  ON note (current_holder_id, updated_at DESC) WHERE status = 'pending';
