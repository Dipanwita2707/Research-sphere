-- Research CV sections the author fills in on their profile (education, experience, teaching, skills,
-- memberships, awards, presentations, references). The one-page CV adds them to the data the system holds.
ALTER TABLE "research_profile_identity" ADD COLUMN "cv_details" JSONB NOT NULL DEFAULT '{}';
