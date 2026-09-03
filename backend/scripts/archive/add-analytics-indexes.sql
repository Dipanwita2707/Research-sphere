-- Analytics performance indexes
-- Run once against the Neon DB: psql <connection_string> -f add-analytics-indexes.sql
-- These match the @@index directives added to schema.prisma.
-- CONCURRENTLY means no table lock -- safe to run in production.

-- research_contribution composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rc_submitted_at
  ON research_contribution (submitted_at)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rc_school_submitted
  ON research_contribution (school_id, submitted_at)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rc_dept_submitted
  ON research_contribution (department_id, submitted_at)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rc_pubtype_school_submitted
  ON research_contribution (publication_type, school_id, submitted_at)
  WHERE submitted_at IS NOT NULL;

-- ipr_application composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ipr_submitted_at
  ON ipr_application (submitted_at)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ipr_school_submitted
  ON ipr_application (school_id, submitted_at)
  WHERE submitted_at IS NOT NULL;

-- grant_application composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grant_submitted_at
  ON grant_application (submitted_at)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grant_school_submitted
  ON grant_application (school_id, submitted_at)
  WHERE submitted_at IS NOT NULL;
