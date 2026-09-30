-- AlterTable: Add percentage-based incentive distribution fields to research_incentive_policy
ALTER TABLE "research_incentive_policy" 
ADD COLUMN "first_author_percentage" DECIMAL(5,2) DEFAULT 40,
ADD COLUMN "corresponding_author_percentage" DECIMAL(5,2) DEFAULT 30;

-- Comment the purpose of these fields
COMMENT ON COLUMN "research_incentive_policy"."first_author_percentage" IS 'Percentage of total incentive for first author (default 40%)';
COMMENT ON COLUMN "research_incentive_policy"."corresponding_author_percentage" IS 'Percentage of total incentive for corresponding author (default 30%)';
COMMENT ON COLUMN "research_incentive_policy"."author_type_multipliers" IS 'DEPRECATED: Use first_author_percentage and corresponding_author_percentage instead. Remaining % divided among co-authors.';
