-- Add new book fields to research_contribution table
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "book_indexing_type" VARCHAR(32);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "book_letter" VARCHAR(8);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "personal_email" VARCHAR(256);

-- Update communicatedWithOfficialId default to true
ALTER TABLE "research_contribution" ALTER COLUMN "communicated_with_official_id" SET DEFAULT true;
