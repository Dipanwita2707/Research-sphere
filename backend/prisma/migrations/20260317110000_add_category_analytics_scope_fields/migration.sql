ALTER TABLE "public"."central_department_permission"
ADD COLUMN IF NOT EXISTS "assigned_ipr_analytics_school_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "assigned_research_analytics_school_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "assigned_book_analytics_school_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "assigned_conference_analytics_school_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "assigned_grant_analytics_school_ids" JSONB NOT NULL DEFAULT '[]'::jsonb;
