/*
  Warnings:

  - You are about to drop the column `targeted_research_type` on the `research_contribution` table. All the data in the column will be lost.
  - You are about to alter the column `manuscript_file_path` on the `research_contribution` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(512)`.
  - Made the column `section_id` on table `student_details` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'APPROVE', 'REJECT', 'SUBMIT', 'REVIEW', 'UPLOAD', 'DOWNLOAD', 'EMAIL_SENT', 'PERMISSION_CHANGE', 'STATUS_CHANGE', 'CONFIG_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "research_tracker_status_enum" AS ENUM ('writing', 'communicated', 'submitted', 'rejected', 'accepted', 'published');

-- CreateEnum
CREATE TYPE "grant_project_type_enum" AS ENUM ('indian', 'international');

-- CreateEnum
CREATE TYPE "grant_project_status_enum" AS ENUM ('submitted', 'approved');

-- CreateEnum
CREATE TYPE "grant_project_category_enum" AS ENUM ('govt', 'non_govt', 'industry');

-- CreateEnum
CREATE TYPE "grant_funding_agency_enum" AS ENUM ('dst', 'dbt', 'anrf', 'csir', 'icssr', 'other');

-- CreateEnum
CREATE TYPE "grant_investigator_role_enum" AS ENUM ('pi', 'co_pi');

-- CreateEnum
CREATE TYPE "grant_application_status_enum" AS ENUM ('draft', 'submitted', 'under_review', 'changes_required', 'resubmitted', 'recommended', 'approved', 'rejected', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "distribution_method_enum" AS ENUM ('author_role_based', 'author_position_based');

-- CreateEnum
CREATE TYPE "quartile_enum" AS ENUM ('Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4');

-- AlterEnum
ALTER TYPE "ipr_status_enum" ADD VALUE 'pending_mentor_approval';

-- DropForeignKey
ALTER TABLE "student_details" DROP CONSTRAINT "student_details_section_id_fkey";

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "action_type" "AuditActionType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "category" VARCHAR(64),
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "module" VARCHAR(64),
ADD COLUMN     "new_values" JSONB,
ADD COLUMN     "old_values" JSONB,
ADD COLUMN     "request_method" VARCHAR(10),
ADD COLUMN     "request_path" VARCHAR(512),
ADD COLUMN     "response_status" INTEGER,
ADD COLUMN     "session_id" VARCHAR(256),
ADD COLUMN     "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO';

-- AlterTable
ALTER TABLE "central_department_permission" ADD COLUMN     "assigned_grant_school_ids" JSONB DEFAULT '[]',
ADD COLUMN     "assigned_monthly_report_department_ids" JSONB DEFAULT '[]',
ADD COLUMN     "assigned_monthly_report_school_ids" JSONB DEFAULT '[]',
ALTER COLUMN "assigned_research_school_ids" DROP NOT NULL,
ALTER COLUMN "assigned_book_school_ids" DROP NOT NULL,
ALTER COLUMN "assigned_conference_school_ids" DROP NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution" DROP COLUMN "targeted_research_type",
ADD COLUMN     "distribution_method_used" "distribution_method_enum",
ADD COLUMN     "indexing_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "quartile" "quartile_enum",
ADD COLUMN     "sdg_goals" TEXT[],
ALTER COLUMN "international_author" DROP NOT NULL,
ALTER COLUMN "foreign_collaborations_count" DROP NOT NULL,
ALTER COLUMN "interdisciplinary_from_sgt" DROP NOT NULL,
ALTER COLUMN "students_from_sgt" DROP NOT NULL,
ALTER COLUMN "total_authors" DROP NOT NULL,
ALTER COLUMN "sgt_affiliated_authors" DROP NOT NULL,
ALTER COLUMN "internal_co_authors" DROP NOT NULL,
ALTER COLUMN "manuscript_file_path" SET DATA TYPE VARCHAR(512),
ALTER COLUMN "indexing_details" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "research_contribution_applicant_details" ALTER COLUMN "is_phd_work" DROP NOT NULL,
ALTER COLUMN "addresses_societal" DROP NOT NULL,
ALTER COLUMN "addresses_government" DROP NOT NULL,
ALTER COLUMN "addresses_environmental" DROP NOT NULL,
ALTER COLUMN "addresses_industrial" DROP NOT NULL,
ALTER COLUMN "addresses_business" DROP NOT NULL,
ALTER COLUMN "addresses_conceptual" DROP NOT NULL,
ALTER COLUMN "enriches_discipline" DROP NOT NULL,
ALTER COLUMN "is_newsworthy" DROP NOT NULL,
ALTER COLUMN "metadata" DROP NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution_author" ADD COLUMN     "author_position" INTEGER,
ALTER COLUMN "is_phd_work" DROP NOT NULL,
ALTER COLUMN "addresses_societal" DROP NOT NULL,
ALTER COLUMN "addresses_government" DROP NOT NULL,
ALTER COLUMN "addresses_environmental" DROP NOT NULL,
ALTER COLUMN "addresses_industrial" DROP NOT NULL,
ALTER COLUMN "addresses_business" DROP NOT NULL,
ALTER COLUMN "addresses_conceptual" DROP NOT NULL,
ALTER COLUMN "is_newsworthy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "research_incentive_policy" ADD COLUMN     "corresponding_author_percentage" DECIMAL(5,2) DEFAULT 30,
ADD COLUMN     "distribution_method" "distribution_method_enum" NOT NULL DEFAULT 'author_role_based',
ADD COLUMN     "first_author_percentage" DECIMAL(5,2) DEFAULT 40,
ALTER COLUMN "author_type_multipliers" SET DEFAULT '{"co_author": 0.5, "first_author": 1.0, "corresponding_author": 0.8, "first_and_corresponding_author": 1.2}',
ALTER COLUMN "indexing_bonuses" SET DEFAULT '{"ugc": 2500, "wos": 7500, "both": 10000, "scopus": 5000}',
ALTER COLUMN "impact_factor_tiers" SET DEFAULT '[{"max": 1, "min": 0, "bonus": 0}, {"max": 3, "min": 1, "bonus": 5000}, {"max": 5, "min": 3, "bonus": 10000}, {"max": 100, "min": 5, "bonus": 20000}]';

-- AlterTable
ALTER TABLE "student_details" ALTER COLUMN "section_id" SET NOT NULL;

-- DropEnum
DROP TYPE "targeted_research_type_enum";

-- CreateTable
CREATE TABLE "audit_report_config" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(128) NOT NULL,
    "email" VARCHAR(256) NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "receive_monthly" BOOLEAN NOT NULL DEFAULT true,
    "receive_weekly" BOOLEAN NOT NULL DEFAULT false,
    "receive_daily" BOOLEAN NOT NULL DEFAULT false,
    "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "severities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_report_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_report_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "report_type" VARCHAR(32) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "recipients" TEXT[],
    "total_logs" INTEGER NOT NULL,
    "file_path" TEXT,
    "status" VARCHAR(32) NOT NULL,
    "error_msg" TEXT,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_report_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "policy_name" VARCHAR(255) NOT NULL,
    "authored_incentive_amount" DECIMAL(15,2) NOT NULL,
    "authored_points" INTEGER NOT NULL,
    "edited_incentive_amount" DECIMAL(15,2) NOT NULL,
    "edited_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "indexing_bonuses" JSONB DEFAULT '{"scopus_indexed": 10000, "non_indexed": 0, "sgt_publication_house": 2000}',
    "international_bonus" DECIMAL(15,2) DEFAULT 5000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_chapter_incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "policy_name" VARCHAR(255) NOT NULL,
    "authored_incentive_amount" DECIMAL(15,2) NOT NULL,
    "authored_points" INTEGER NOT NULL,
    "edited_incentive_amount" DECIMAL(15,2) NOT NULL,
    "edited_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "indexing_bonuses" JSONB DEFAULT '{"scopus_indexed": 10000, "non_indexed": 0, "sgt_publication_house": 2000}',
    "international_bonus" DECIMAL(15,2) DEFAULT 5000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_chapter_incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "policy_name" VARCHAR(255) NOT NULL,
    "conference_sub_type" VARCHAR(50) NOT NULL,
    "quartile_incentives" JSONB DEFAULT '[]',
    "role_percentages" JSONB DEFAULT '[]',
    "flat_incentive_amount" DECIMAL(15,2),
    "flat_points" INTEGER,
    "split_policy" VARCHAR(50) NOT NULL,
    "international_bonus" DECIMAL(15,2) DEFAULT 5000,
    "best_paper_award_bonus" DECIMAL(15,2) DEFAULT 5000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conference_incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "policy_name" VARCHAR(255) NOT NULL,
    "project_category" VARCHAR(50) NOT NULL,
    "project_type" VARCHAR(50) NOT NULL,
    "base_incentive_amount" DECIMAL(15,2) NOT NULL,
    "base_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "role_percentages" JSONB DEFAULT '[]',
    "funding_amount_multiplier" JSONB,
    "international_bonus" DECIMAL(15,2) DEFAULT 10000,
    "consortium_bonus" DECIMAL(15,2) DEFAULT 5000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_progress_tracker" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tracking_number" VARCHAR(32) NOT NULL,
    "user_id" UUID NOT NULL,
    "publication_type" "research_publication_type_enum" NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "current_status" "research_tracker_status_enum" NOT NULL DEFAULT 'writing',
    "school_id" UUID,
    "department_id" UUID,
    "research_paper_data" JSONB,
    "book_data" JSONB,
    "book_chapter_data" JSONB,
    "conference_paper_data" JSONB,
    "expected_completion_date" DATE,
    "actual_completion_date" DATE,
    "notes" TEXT,
    "research_contribution_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_progress_tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_progress_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tracker_id" UUID NOT NULL,
    "from_status" "research_tracker_status_enum",
    "to_status" "research_tracker_status_enum" NOT NULL,
    "status_data" JSONB,
    "attachments" JSONB DEFAULT '[]',
    "reported_date" DATE NOT NULL,
    "actual_date" DATE,
    "notes" TEXT,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_progress_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_application" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_number" VARCHAR(32),
    "applicant_user_id" UUID,
    "applicant_type" "applicant_type_enum" NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "submitted_amount" DECIMAL(15,2),
    "sdg_goals" TEXT[],
    "project_type" "grant_project_type_enum" NOT NULL DEFAULT 'indian',
    "number_of_consortium_orgs" INTEGER DEFAULT 0,
    "project_status" "grant_project_status_enum" NOT NULL DEFAULT 'submitted',
    "project_category" "grant_project_category_enum" NOT NULL DEFAULT 'govt',
    "funding_agency_type" "grant_funding_agency_enum",
    "funding_agency_name" VARCHAR(256),
    "total_investigators" INTEGER NOT NULL DEFAULT 1,
    "number_of_internal_pis" INTEGER NOT NULL DEFAULT 1,
    "number_of_internal_co_pis" INTEGER NOT NULL DEFAULT 0,
    "is_pi_external" BOOLEAN NOT NULL DEFAULT false,
    "my_role" "grant_investigator_role_enum" NOT NULL DEFAULT 'pi',
    "date_of_submission" DATE,
    "project_start_date" DATE,
    "project_end_date" DATE,
    "project_duration_months" INTEGER,
    "school_id" UUID,
    "department_id" UUID,
    "status" "grant_application_status_enum" NOT NULL DEFAULT 'draft',
    "current_reviewer_id" UUID,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_id" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejected_by_id" UUID,
    "proposal_file_path" VARCHAR(512),
    "supporting_docs_file_paths" JSONB,
    "calculated_incentive_amount" DECIMAL(15,2),
    "calculated_points" INTEGER,
    "incentive_amount" DECIMAL(15,2),
    "points_awarded" INTEGER,
    "credited_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_consortium_organization" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "grant_application_id" UUID NOT NULL,
    "organization_name" VARCHAR(256) NOT NULL,
    "country" VARCHAR(128) NOT NULL,
    "number_of_members" INTEGER NOT NULL DEFAULT 1,
    "is_coordinator" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_consortium_organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_investigator" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "grant_application_id" UUID NOT NULL,
    "user_id" UUID,
    "uid" VARCHAR(64),
    "name" VARCHAR(256) NOT NULL,
    "email" VARCHAR(256),
    "phone" VARCHAR(20),
    "designation" VARCHAR(256),
    "affiliation" VARCHAR(256),
    "department" VARCHAR(256),
    "role_type" "grant_investigator_role_enum" NOT NULL DEFAULT 'co_pi',
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "investigator_type" VARCHAR(64),
    "consortium_org_id" UUID,
    "is_team_coordinator" BOOLEAN NOT NULL DEFAULT false,
    "incentive_share" DECIMAL(15,2),
    "points_share" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_investigator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_application_review" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "grant_application_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewer_role" VARCHAR(64) NOT NULL,
    "comments" TEXT,
    "edits" JSONB,
    "decision" VARCHAR(32) NOT NULL,
    "has_suggestions" BOOLEAN NOT NULL DEFAULT false,
    "suggestions_count" INTEGER NOT NULL DEFAULT 0,
    "pending_suggestions_count" INTEGER NOT NULL DEFAULT 0,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_application_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_application_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "grant_application_id" UUID NOT NULL,
    "from_status" "grant_application_status_enum",
    "to_status" "grant_application_status_enum" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "comments" TEXT,
    "metadata" JSONB,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_application_edit_suggestion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "grant_application_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "field_name" VARCHAR(128) NOT NULL,
    "field_path" VARCHAR(256),
    "original_value" TEXT,
    "suggested_value" TEXT,
    "suggestion_note" TEXT,
    "status" "edit_suggestion_status_enum" NOT NULL DEFAULT 'pending',
    "applicant_response" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_application_edit_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_incentive_policy_is_active_idx" ON "book_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "book_chapter_incentive_policy_is_active_idx" ON "book_chapter_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "conference_incentive_policy_is_active_idx" ON "conference_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "conference_incentive_policy_conference_sub_type_idx" ON "conference_incentive_policy"("conference_sub_type");

-- CreateIndex
CREATE INDEX "grant_incentive_policy_is_active_idx" ON "grant_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "grant_incentive_policy_project_category_idx" ON "grant_incentive_policy"("project_category");

-- CreateIndex
CREATE INDEX "grant_incentive_policy_project_type_idx" ON "grant_incentive_policy"("project_type");

-- CreateIndex
CREATE UNIQUE INDEX "research_progress_tracker_tracking_number_key" ON "research_progress_tracker"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "research_progress_tracker_research_contribution_id_key" ON "research_progress_tracker"("research_contribution_id");

-- CreateIndex
CREATE INDEX "research_progress_tracker_user_id_idx" ON "research_progress_tracker"("user_id");

-- CreateIndex
CREATE INDEX "research_progress_tracker_publication_type_idx" ON "research_progress_tracker"("publication_type");

-- CreateIndex
CREATE INDEX "research_progress_tracker_current_status_idx" ON "research_progress_tracker"("current_status");

-- CreateIndex
CREATE INDEX "research_progress_tracker_school_id_idx" ON "research_progress_tracker"("school_id");

-- CreateIndex
CREATE INDEX "research_progress_tracker_department_id_idx" ON "research_progress_tracker"("department_id");

-- CreateIndex
CREATE INDEX "research_progress_tracker_title_idx" ON "research_progress_tracker"("title");

-- CreateIndex
CREATE INDEX "research_progress_tracker_tracking_number_idx" ON "research_progress_tracker"("tracking_number");

-- CreateIndex
CREATE INDEX "research_progress_status_history_tracker_id_idx" ON "research_progress_status_history"("tracker_id");

-- CreateIndex
CREATE INDEX "research_progress_status_history_to_status_idx" ON "research_progress_status_history"("to_status");

-- CreateIndex
CREATE UNIQUE INDEX "grant_application_application_number_key" ON "grant_application"("application_number");

-- CreateIndex
CREATE INDEX "grant_application_applicant_user_id_idx" ON "grant_application"("applicant_user_id");

-- CreateIndex
CREATE INDEX "grant_application_status_idx" ON "grant_application"("status");

-- CreateIndex
CREATE INDEX "grant_application_project_type_idx" ON "grant_application"("project_type");

-- CreateIndex
CREATE INDEX "grant_application_project_category_idx" ON "grant_application"("project_category");

-- CreateIndex
CREATE INDEX "grant_application_school_id_idx" ON "grant_application"("school_id");

-- CreateIndex
CREATE INDEX "grant_application_department_id_idx" ON "grant_application"("department_id");

-- CreateIndex
CREATE INDEX "grant_consortium_organization_grant_application_id_idx" ON "grant_consortium_organization"("grant_application_id");

-- CreateIndex
CREATE INDEX "grant_investigator_grant_application_id_idx" ON "grant_investigator"("grant_application_id");

-- CreateIndex
CREATE INDEX "grant_investigator_user_id_idx" ON "grant_investigator"("user_id");

-- CreateIndex
CREATE INDEX "grant_investigator_consortium_org_id_idx" ON "grant_investigator"("consortium_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "grant_investigator_grant_application_id_uid_key" ON "grant_investigator"("grant_application_id", "uid");

-- CreateIndex
CREATE INDEX "grant_application_review_grant_application_id_idx" ON "grant_application_review"("grant_application_id");

-- CreateIndex
CREATE INDEX "grant_application_review_reviewer_id_idx" ON "grant_application_review"("reviewer_id");

-- CreateIndex
CREATE INDEX "grant_application_status_history_grant_application_id_idx" ON "grant_application_status_history"("grant_application_id");

-- CreateIndex
CREATE INDEX "grant_application_edit_suggestion_reviewer_id_idx" ON "grant_application_edit_suggestion"("reviewer_id");

-- CreateIndex
CREATE INDEX "grant_application_edit_suggestion_grant_application_id_idx" ON "grant_application_edit_suggestion"("grant_application_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_module_idx" ON "audit_log"("module");

-- CreateIndex
CREATE INDEX "audit_log_action_type_idx" ON "audit_log"("action_type");

-- CreateIndex
CREATE INDEX "audit_log_severity_idx" ON "audit_log"("severity");

-- CreateIndex
CREATE INDEX "research_contribution_conference_sub_type_idx" ON "research_contribution"("conference_sub_type");

-- RenameForeignKey
ALTER TABLE "research_contribution_applicant_details" RENAME CONSTRAINT "research_contribution_applicant_details_research_contribut_fkey" TO "research_contribution_applicant_details_contribution_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_author" RENAME CONSTRAINT "research_contribution_author_research_contribution_id_fkey" TO "research_contribution_author_contribution_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_edit_suggestion" RENAME CONSTRAINT "research_contribution_edit_suggestion_research_contributio_fkey" TO "research_contribution_edit_suggestion_contribution_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_edit_suggestion" RENAME CONSTRAINT "research_contribution_edit_suggestion_reviewer_id_fkey" TO "research_contribution_edit_suggestion_reviewer_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_review" RENAME CONSTRAINT "research_contribution_review_research_contribution_id_fkey" TO "research_contribution_review_contribution_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_status_history" RENAME CONSTRAINT "research_contribution_status_history_changed_by_id_fkey" TO "research_contribution_status_history_changed_by_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_status_history" RENAME CONSTRAINT "research_contribution_status_history_research_contribution_fkey" TO "research_contribution_status_history_contribution_fkey";

-- RenameForeignKey
ALTER TABLE "research_incentive_policy" RENAME CONSTRAINT "research_incentive_policy_created_by_id_fkey" TO "research_incentive_policy_created_by_fkey";

-- RenameForeignKey
ALTER TABLE "research_incentive_policy" RENAME CONSTRAINT "research_incentive_policy_updated_by_id_fkey" TO "research_incentive_policy_updated_by_fkey";

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_research_contribution_id_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_status_history" ADD CONSTRAINT "research_progress_status_history_tracker_id_fkey" FOREIGN KEY ("tracker_id") REFERENCES "research_progress_tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application" ADD CONSTRAINT "grant_application_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application" ADD CONSTRAINT "grant_application_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application" ADD CONSTRAINT "grant_application_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_consortium_organization" ADD CONSTRAINT "grant_consortium_organization_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_investigator" ADD CONSTRAINT "grant_investigator_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_investigator" ADD CONSTRAINT "grant_investigator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_investigator" ADD CONSTRAINT "grant_investigator_consortium_org_id_fkey" FOREIGN KEY ("consortium_org_id") REFERENCES "grant_consortium_organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_review" ADD CONSTRAINT "grant_application_review_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_review" ADD CONSTRAINT "grant_application_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_status_history" ADD CONSTRAINT "grant_application_status_history_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_status_history" ADD CONSTRAINT "grant_application_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_edit_suggestion" ADD CONSTRAINT "grant_application_edit_suggestion_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_edit_suggestion" ADD CONSTRAINT "grant_application_edit_suggestion_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "unique_active_policy_per_type" RENAME TO "incentive_policy_ipr_type_is_active_key";

-- RenameIndex
ALTER INDEX "research_contribution_applicant_details_research_contributi_key" RENAME TO "research_contribution_applicant_details_contribution_key";

-- RenameIndex
ALTER INDEX "research_contribution_author_research_contribution_id_idx" RENAME TO "research_contribution_author_contribution_id_idx";

-- RenameIndex
ALTER INDEX "research_contribution_author_research_contribution_id_uid_key" RENAME TO "research_contribution_author_contribution_uid_key";

-- RenameIndex
ALTER INDEX "research_contribution_edit_suggestion_research_contribution_idx" RENAME TO "research_contribution_edit_suggestion_contribution_id_idx";

-- RenameIndex
ALTER INDEX "research_contribution_review_research_contribution_id_idx" RENAME TO "research_contribution_review_contribution_id_idx";

-- RenameIndex
ALTER INDEX "research_contribution_status_history_research_contribution__idx" RENAME TO "research_contribution_status_history_contribution_id_idx";
