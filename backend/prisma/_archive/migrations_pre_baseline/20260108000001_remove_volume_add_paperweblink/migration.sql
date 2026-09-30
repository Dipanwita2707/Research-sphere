-- AlterTable ResearchContribution: Remove volume field and add paperweblink field
ALTER TABLE "research_contribution" DROP COLUMN IF EXISTS "volume";
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "paperweblink" VARCHAR(512);
