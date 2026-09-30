-- Add book-specific fields to research_contribution table
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "national_international" VARCHAR(32);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "book_publication_type" VARCHAR(32);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "communicated_with_official_id" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "faculty_remarks" TEXT;

-- Add book permissions to central_department_permission table
ALTER TABLE "central_department_permission" ADD COLUMN IF NOT EXISTS "assigned_book_school_ids" JSONB DEFAULT '[]';
