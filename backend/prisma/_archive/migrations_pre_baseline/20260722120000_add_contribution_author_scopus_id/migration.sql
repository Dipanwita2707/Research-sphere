ALTER TABLE "research_contribution_author" ADD COLUMN IF NOT EXISTS "scopus_author_id" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "research_contribution_author_scopus_author_id_idx"
  ON "research_contribution_author"("scopus_author_id");
