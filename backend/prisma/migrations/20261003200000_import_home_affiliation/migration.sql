-- Synced works are no longer auto-submitted: each import records whether the owner is affiliated
-- with this university on the paper, and the researcher submits affiliated ones for incentive.
-- Existing imports are classified and returned to draft by scripts/research/classify-imports.js.
ALTER TABLE "research_contribution"
  ADD COLUMN "home_affiliation" VARCHAR(16),
  ADD COLUMN "home_affiliation_basis" VARCHAR(32),
  ADD COLUMN "home_affiliation_detail" VARCHAR(512);

ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_home_affiliation_check"
  CHECK ("home_affiliation" IS NULL OR "home_affiliation" IN ('affiliated', 'not_affiliated', 'unknown'));

CREATE INDEX "research_contribution_applicant_user_id_home_affiliation_idx" ON "research_contribution"("applicant_user_id", "home_affiliation");
