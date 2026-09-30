-- AlterTable
ALTER TABLE "research_contribution" ADD COLUMN "sdg_goals" TEXT[];

-- Add comment
COMMENT ON COLUMN "research_contribution"."sdg_goals" IS 'UN Sustainable Development Goals (SDGs) relevant to this research';
