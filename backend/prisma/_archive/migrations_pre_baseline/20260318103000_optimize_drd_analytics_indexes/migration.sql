-- DRD analytics performance indexes

CREATE INDEX IF NOT EXISTS "research_contribution_applicant_pub_submitted_status_idx"
  ON "research_contribution" ("applicant_user_id", "publication_type", "submitted_at" DESC, "status");

CREATE INDEX IF NOT EXISTS "research_contribution_school_pub_status_submitted_idx"
  ON "research_contribution" ("school_id", "publication_type", "status", "submitted_at" DESC);

CREATE INDEX IF NOT EXISTS "research_contribution_department_pub_status_submitted_idx"
  ON "research_contribution" ("department_id", "publication_type", "status", "submitted_at" DESC);

CREATE INDEX IF NOT EXISTS "ipr_application_applicant_status_submitted_idx"
  ON "ipr_application" ("applicant_user_id", "status", "submitted_at" DESC);

CREATE INDEX IF NOT EXISTS "grant_application_applicant_status_submitted_idx"
  ON "grant_application" ("applicant_user_id", "status", "submitted_at" DESC);
