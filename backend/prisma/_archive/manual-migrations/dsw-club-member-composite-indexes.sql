-- ============================================================
-- Migration: DSW ClubMember composite indexes
-- File:      dsw-club-member-composite-indexes.sql
-- Created:   2025
-- Reason:    Fix slow DSW club endpoints (~4 s) caused by
--            missing composite indexes on the club_member table.
--
-- Problem queries:
--   1. GET /clubs/my   — WHERE studentId = ? AND isActive = true
--                        inside an OR (members.some{...}) filter
--   2. GET /clubs/:id  — WHERE clubId = ? AND isActive = true
--                        ORDER BY joinedAt ASC  (member list + _count)
--   3. POST /members   — _count aggregate WHERE isActive = true
--
-- All three used single-column indexes and forced PostgreSQL to
-- re-filter a large intermediate result set.
-- ============================================================

-- 1. (studentId, isActive)
--    Powers the "myClubs" OR branch:
--      members.some { studentId: user.id, isActive: true }
--    Without this, Postgres uses idx_club_member_student_id and then
--    filters every row for isActive, touching O(total memberships) rows.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "club_member_studentId_isActive_idx"
  ON "club_member" ("student_id", "is_active");

-- 2. (clubId, isActive)
--    Powers active-member COUNT aggregates used in every list view:
--      _count: { members: { where: { isActive: true } } }
--    Also used by getClubById member list filter.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "club_member_clubId_isActive_idx"
  ON "club_member" ("club_id", "is_active");

-- 3. (clubId, isActive, joinedAt)
--    Powers getClubById members sub-query:
--      WHERE clubId = ? AND isActive = true ORDER BY joinedAt ASC LIMIT 10
--    The full three-column index lets Postgres satisfy the WHERE and ORDER BY
--    from the index alone (index-only scan), skipping a sort step.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "club_member_clubId_isActive_joinedAt_idx"
  ON "club_member" ("club_id", "is_active", "joined_at" ASC);

-- ============================================================
-- Rollback (run if you need to revert):
--
--   DROP INDEX CONCURRENTLY IF EXISTS "club_member_studentId_isActive_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "club_member_clubId_isActive_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "club_member_clubId_isActive_joinedAt_idx";
-- ============================================================
