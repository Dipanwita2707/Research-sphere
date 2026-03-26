-- Optimize permission lookup queries used by _resolveAccess in drdAnalytics.service.js.
-- These queries fire: WHERE userId = ? AND isActive = true
-- Currently only (userId) index exists; adding (userId, isActive) composite allows
-- Postgres to satisfy the filter with an index-only scan and avoid a seq-scan / filter step.

CREATE INDEX IF NOT EXISTS "department_permission_user_active_idx"
  ON "department_permission" ("user_id", "is_active");

CREATE INDEX IF NOT EXISTS "central_department_permission_user_active_idx"
  ON "central_department_permission" ("user_id", "is_active");
