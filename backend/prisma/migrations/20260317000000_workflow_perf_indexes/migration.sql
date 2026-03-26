-- Workflow and research-family performance indexes

CREATE INDEX "user_login_role_status_idx" ON "public"."user_login"("role", "status");

CREATE INDEX "ipr_application_applicant_created_at_idx"
ON "public"."ipr_application"("applicant_user_id", "created_at" DESC);

CREATE INDEX "ipr_application_reviewer_status_idx"
ON "public"."ipr_application"("current_reviewer_id", "status");

CREATE INDEX "ipr_application_school_status_submitted_idx"
ON "public"."ipr_application"("school_id", "status", "submitted_at" DESC);

CREATE INDEX "ipr_application_department_status_submitted_idx"
ON "public"."ipr_application"("department_id", "status", "submitted_at" DESC);

CREATE INDEX "ipr_review_reviewer_reviewed_at_idx"
ON "public"."ipr_review"("reviewer_id", "reviewed_at" DESC);

CREATE INDEX "ipr_review_decision_application_idx"
ON "public"."ipr_review"("decision", "ipr_application_id");

CREATE INDEX "research_contribution_applicant_created_at_idx"
ON "public"."research_contribution"("applicant_user_id", "created_at" DESC);

CREATE INDEX "research_contribution_reviewer_status_idx"
ON "public"."research_contribution"("current_reviewer_id", "status");

CREATE INDEX "research_contribution_school_status_submitted_idx"
ON "public"."research_contribution"("school_id", "status", "submitted_at" DESC);

CREATE INDEX "research_contribution_department_status_submitted_idx"
ON "public"."research_contribution"("department_id", "status", "submitted_at" DESC);

CREATE INDEX "research_contribution_review_reviewer_reviewed_at_idx"
ON "public"."research_contribution_review"("reviewer_id", "reviewed_at" DESC);

CREATE INDEX "research_contribution_review_decision_contribution_idx"
ON "public"."research_contribution_review"("decision", "research_contribution_id");

CREATE INDEX "grant_application_applicant_created_at_idx"
ON "public"."grant_application"("applicant_user_id", "created_at" DESC);

CREATE INDEX "grant_application_reviewer_status_idx"
ON "public"."grant_application"("current_reviewer_id", "status");

CREATE INDEX "grant_application_school_status_submitted_idx"
ON "public"."grant_application"("school_id", "status", "submitted_at" DESC);

CREATE INDEX "grant_application_department_status_submitted_idx"
ON "public"."grant_application"("department_id", "status", "submitted_at" DESC);

CREATE INDEX "grant_application_review_reviewer_reviewed_at_idx"
ON "public"."grant_application_review"("reviewer_id", "reviewed_at" DESC);

CREATE INDEX "grant_application_review_decision_application_idx"
ON "public"."grant_application_review"("decision", "grant_application_id");
