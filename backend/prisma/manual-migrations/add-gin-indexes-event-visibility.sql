-- GIN indexes for EventVisibility JSON columns
-- These speed up array_contains queries used by buildVisibilityFilter
-- 
-- Run with: npx prisma db execute --file prisma/manual-migrations/add-gin-indexes-event-visibility.sql

-- GIN index on visibleToRoles (most frequently queried — every list call)
CREATE INDEX IF NOT EXISTS "event_visibility_visibleToRoles_gin"
  ON "event_visibility" USING GIN ("visibleToRoles" jsonb_path_ops);

-- GIN indexes on student filter columns (frequent for student users)
CREATE INDEX IF NOT EXISTS "event_visibility_allowedSchoolIds_gin"
  ON "event_visibility" USING GIN ("allowed_school_ids" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "event_visibility_allowedDepartmentIds_gin"
  ON "event_visibility" USING GIN ("allowed_department_ids" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "event_visibility_allowedProgramIds_gin"
  ON "event_visibility" USING GIN ("allowed_program_ids" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "event_visibility_allowedBatchYears_gin"
  ON "event_visibility" USING GIN ("allowed_batch_years" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "event_visibility_allowedSectionIds_gin"
  ON "event_visibility" USING GIN ("allowed_section_ids" jsonb_path_ops);
