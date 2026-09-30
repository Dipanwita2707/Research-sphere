/*
  Update IPR workflow:
  - Remove dean approval status(drd_approved, under_dean_review, dean_approved, dean_rejected)
  - Add drd_head_approved status
  - Add assigned_school_ids to central_department_permission
  - Add revision_count to ipr_application
*/

-- Step 1: Create the new enum type
CREATE TYPE "ipr_status_enum_new" AS ENUM ('draft', 'submitted', 'under_drd_review', 'changes_required', 'resubmitted', 'recommended_to_head', 'drd_head_approved', 'drd_rejected', 'submitted_to_govt', 'govt_application_filed', 'published', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed', 'cancelled');

-- Step 2: Add temporary columns
ALTER TABLE "ipr_application" ADD COLUMN "status_new" "ipr_status_enum_new";
ALTER TABLE "ipr_status_history" ADD COLUMN "from_status_new" "ipr_status_enum_new";
ALTER TABLE "ipr_status_history" ADD COLUMN "to_status_new" "ipr_status_enum_new";

-- Step 3: Migrate data to new columns with mapping
UPDATE "ipr_application" SET "status_new" = 
  CASE 
    WHEN "status"::text = 'drd_approved' THEN 'drd_head_approved'::"ipr_status_enum_new"
    WHEN "status"::text = 'under_dean_review' THEN 'under_finance_review'::"ipr_status_enum_new"
    WHEN "status"::text = 'dean_approved' THEN 'under_finance_review'::"ipr_status_enum_new"
    WHEN "status"::text = 'dean_rejected' THEN 'drd_rejected'::"ipr_status_enum_new"
    ELSE "status"::text::"ipr_status_enum_new"
  END;

UPDATE "ipr_status_history" SET "from_status_new" = 
  CASE 
    WHEN "from_status"::text = 'drd_approved' THEN 'drd_head_approved'::"ipr_status_enum_new"
    WHEN "from_status"::text = 'under_dean_review' THEN 'under_finance_review'::"ipr_status_enum_new"
    WHEN "from_status"::text = 'dean_approved' THEN 'under_finance_review'::"ipr_status_enum_new"
    WHEN "from_status"::text = 'dean_rejected' THEN 'drd_rejected'::"ipr_status_enum_new"
    ELSE "from_status"::text::"ipr_status_enum_new"
  END;

UPDATE "ipr_status_history" SET "to_status_new" = 
  CASE 
    WHEN "to_status"::text = 'drd_approved' THEN 'drd_head_approved'::"ipr_status_enum_new"
    WHEN "to_status"::text = 'under_dean_review' THEN 'under_finance_review'::"ipr_status_enum_new"
    WHEN "to_status"::text = 'dean_approved' THEN 'under_finance_review'::"ipr_status_enum_new"
    WHEN "to_status"::text = 'dean_rejected' THEN 'drd_rejected'::"ipr_status_enum_new"
    ELSE "to_status"::text::"ipr_status_enum_new"
  END;

-- Step 4: Drop old columns and rename new ones
ALTER TABLE "ipr_application" DROP COLUMN "status";
ALTER TABLE "ipr_application" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "ipr_application" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "ipr_application" ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "ipr_status_history" DROP COLUMN "from_status";
ALTER TABLE "ipr_status_history" RENAME COLUMN "from_status_new" TO "from_status";

ALTER TABLE "ipr_status_history" DROP COLUMN "to_status";
ALTER TABLE "ipr_status_history" RENAME COLUMN "to_status_new" TO "to_status";
ALTER TABLE "ipr_status_history" ALTER COLUMN "to_status" SET NOT NULL;

-- Step 5: Drop old enum type
DROP TYPE "ipr_status_enum";
ALTER TYPE "ipr_status_enum_new" RENAME TO "ipr_status_enum";

-- Step 6: Add new columns to other tables (if not exists)
ALTER TABLE "central_department_permission" ADD COLUMN IF NOT EXISTS "assigned_school_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ipr_application" ADD COLUMN IF NOT EXISTS "revision_count" INTEGER NOT NULL DEFAULT 0;

-- NOTE: Duplicate ALTER TABLE statements removed to avoid failure when column already exists

