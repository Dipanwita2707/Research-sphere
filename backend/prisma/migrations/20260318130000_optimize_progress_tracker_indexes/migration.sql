-- Add composite (schoolId, createdAt) and (departmentId, createdAt) indexes to
-- research_progress_tracker. The analytics queries filter on schoolId + createdAt range
-- in a WHERE AND clause; a single-column schoolId index forces a per-row createdAt filter
-- step. The composite index satisfies both predicates in one scan.

CREATE INDEX IF NOT EXISTS "research_progress_tracker_school_created_idx"
  ON "research_progress_tracker" ("school_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "research_progress_tracker_dept_created_idx"
  ON "research_progress_tracker" ("department_id", "created_at" DESC);
