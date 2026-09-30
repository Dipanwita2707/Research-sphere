/*
  Warnings:

  - The values [rejected,published] on the enum `research_paper_status_enum` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `quartile` on the `research_contribution` table. All the data in the column will be lost.
  - You are about to drop the column `sdg_goals` on the `research_contribution` table. All the data in the column will be lost.
  - You are about to drop the column `corresponding_author_percentage` on the `research_incentive_policy` table. All the data in the column will be lost.
  - You are about to drop the column `first_author_percentage` on the `research_incentive_policy` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[application_number]` on the table `ipr_application` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publication_type,is_active]` on the table `research_incentive_policy` will be added. If there are existing duplicate values, this will fail.
  - Made the column `assigned_research_school_ids` on table `central_department_permission` required. This step will fail if there are existing NULL values in that column.
  - Made the column `assigned_book_school_ids` on table `central_department_permission` required. This step will fail if there are existing NULL values in that column.
  - Made the column `assigned_conference_school_ids` on table `central_department_permission` required. This step will fail if there are existing NULL values in that column.
  - Made the column `international_author` on table `research_contribution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `foreign_collaborations_count` on table `research_contribution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `interdisciplinary_from_sgt` on table `research_contribution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `students_from_sgt` on table `research_contribution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `total_authors` on table `research_contribution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sgt_affiliated_authors` on table `research_contribution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `internal_co_authors` on table `research_contribution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_phd_work` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_societal` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_government` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_environmental` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_industrial` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_business` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_conceptual` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `enriches_discipline` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_newsworthy` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `research_contribution_applicant_details` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_phd_work` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_societal` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_government` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_environmental` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_industrial` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_business` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.
  - Made the column `addresses_conceptual` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_newsworthy` on table `research_contribution_author` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- Note: pending_mentor_approval already exists in database, commenting out to avoid duplicate
-- ALTER TYPE "ipr_status_enum" ADD VALUE 'pending_mentor_approval';

-- AlterEnum
BEGIN;
CREATE TYPE "research_paper_status_enum_new" AS ENUM ('draft', 'submitted', 'under_review', 'changes_required', 'resubmitted', 'approved');
ALTER TABLE "research_paper" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "research_paper" ALTER COLUMN "status" TYPE "research_paper_status_enum_new" USING ("status"::text::"research_paper_status_enum_new");
ALTER TABLE "research_paper_status_history" ALTER COLUMN "from_status" TYPE "research_paper_status_enum_new" USING ("from_status"::text::"research_paper_status_enum_new");
ALTER TABLE "research_paper_status_history" ALTER COLUMN "to_status" TYPE "research_paper_status_enum_new" USING ("to_status"::text::"research_paper_status_enum_new");
ALTER TYPE "research_paper_status_enum" RENAME TO "research_paper_status_enum_old";
ALTER TYPE "research_paper_status_enum_new" RENAME TO "research_paper_status_enum";
DROP TYPE "research_paper_status_enum_old";
ALTER TABLE "research_paper" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- DropForeignKey
ALTER TABLE "student_details" DROP CONSTRAINT "student_details_section_id_fkey";

-- DropIndex
DROP INDEX "research_contribution_conference_sub_type_idx";

-- AlterTable
ALTER TABLE "central_department_permission" ALTER COLUMN "assigned_research_school_ids" SET NOT NULL,
ALTER COLUMN "assigned_book_school_ids" SET NOT NULL,
ALTER COLUMN "assigned_conference_school_ids" SET NOT NULL;

-- AlterTable
ALTER TABLE "ipr_application" ADD COLUMN     "application_number" VARCHAR(32),
ADD COLUMN     "conversion_date" TIMESTAMPTZ(6),
ADD COLUMN     "prototype_file_path" TEXT,
ADD COLUMN     "source_provisional_id" UUID;

-- AlterTable
ALTER TABLE "research_contribution" DROP COLUMN "quartile",
DROP COLUMN "sdg_goals",
ALTER COLUMN "international_author" SET NOT NULL,
ALTER COLUMN "foreign_collaborations_count" SET NOT NULL,
ALTER COLUMN "interdisciplinary_from_sgt" SET NOT NULL,
ALTER COLUMN "students_from_sgt" SET NOT NULL,
ALTER COLUMN "total_authors" SET NOT NULL,
ALTER COLUMN "sgt_affiliated_authors" SET NOT NULL,
ALTER COLUMN "internal_co_authors" SET NOT NULL,
ALTER COLUMN "manuscript_file_path" SET DATA TYPE TEXT,
ALTER COLUMN "indexing_details" DROP DEFAULT;

-- AlterTable
ALTER TABLE "research_contribution_applicant_details" ALTER COLUMN "is_phd_work" SET NOT NULL,
ALTER COLUMN "addresses_societal" SET NOT NULL,
ALTER COLUMN "addresses_government" SET NOT NULL,
ALTER COLUMN "addresses_environmental" SET NOT NULL,
ALTER COLUMN "addresses_industrial" SET NOT NULL,
ALTER COLUMN "addresses_business" SET NOT NULL,
ALTER COLUMN "addresses_conceptual" SET NOT NULL,
ALTER COLUMN "enriches_discipline" SET NOT NULL,
ALTER COLUMN "is_newsworthy" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution_author" ADD COLUMN     "designation" VARCHAR(256),
ADD COLUMN     "is_international" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "is_phd_work" SET NOT NULL,
ALTER COLUMN "addresses_societal" SET NOT NULL,
ALTER COLUMN "addresses_government" SET NOT NULL,
ALTER COLUMN "addresses_environmental" SET NOT NULL,
ALTER COLUMN "addresses_industrial" SET NOT NULL,
ALTER COLUMN "addresses_business" SET NOT NULL,
ALTER COLUMN "addresses_conceptual" SET NOT NULL,
ALTER COLUMN "is_newsworthy" SET NOT NULL;

-- AlterTable
ALTER TABLE "research_incentive_policy" DROP COLUMN "corresponding_author_percentage",
DROP COLUMN "first_author_percentage",
ALTER COLUMN "author_type_multipliers" DROP DEFAULT,
ALTER COLUMN "indexing_bonuses" DROP DEFAULT,
ALTER COLUMN "impact_factor_tiers" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_details" ALTER COLUMN "section_id" DROP NOT NULL;

-- DropEnum
DROP TYPE "quartile_enum";

-- CreateTable
CREATE TABLE "ipr_status_update" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "update_message" TEXT NOT NULL,
    "update_type" VARCHAR(64) NOT NULL,
    "priority" VARCHAR(32) NOT NULL DEFAULT 'medium',
    "is_visible_to_applicant" BOOLEAN NOT NULL DEFAULT true,
    "is_visible_to_inventors" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_status_update_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_type" VARCHAR(50) NOT NULL,
    "policy_name" VARCHAR(255) NOT NULL,
    "base_incentive_amount" DECIMAL(15,2) NOT NULL,
    "base_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "primary_inventor_share" DECIMAL(5,2),
    "filing_type_multiplier" JSONB,
    "project_type_bonus" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "ipr_updates" BOOLEAN NOT NULL DEFAULT true,
    "task_reminders" BOOLEAN NOT NULL DEFAULT true,
    "system_alerts" BOOLEAN NOT NULL DEFAULT true,
    "weekly_digest" BOOLEAN NOT NULL DEFAULT false,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'light',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "compact_view" BOOLEAN NOT NULL DEFAULT false,
    "show_tips" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ipr_status_update_ipr_application_id_idx" ON "ipr_status_update"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_status_update_created_by_id_idx" ON "ipr_status_update"("created_by_id");

-- CreateIndex
CREATE INDEX "ipr_status_update_update_type_idx" ON "ipr_status_update"("update_type");

-- CreateIndex
CREATE INDEX "incentive_policy_ipr_type_idx" ON "incentive_policy"("ipr_type");

-- CreateIndex
CREATE INDEX "incentive_policy_is_active_idx" ON "incentive_policy"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_policy_per_type" ON "incentive_policy"("ipr_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_application_application_number_key" ON "ipr_application"("application_number");

-- CreateIndex
CREATE INDEX "ipr_application_status_idx" ON "ipr_application"("status");

-- CreateIndex
CREATE INDEX "ipr_application_source_provisional_id_idx" ON "ipr_application"("source_provisional_id");

-- Note: unique_active_research_policy_per_type index already exists from migration 20251208000000_add_research_contribution_module
-- Removed duplicate index creation to avoid conflict

-- RenameForeignKey
ALTER TABLE "research_contribution_applicant_details" RENAME CONSTRAINT "research_contribution_applicant_details_contribution_fkey" TO "research_contribution_applicant_details_research_contribut_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_author" RENAME CONSTRAINT "research_contribution_author_contribution_fkey" TO "research_contribution_author_research_contribution_id_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_edit_suggestion" RENAME CONSTRAINT "research_contribution_edit_suggestion_contribution_fkey" TO "research_contribution_edit_suggestion_research_contributio_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_edit_suggestion" RENAME CONSTRAINT "research_contribution_edit_suggestion_reviewer_fkey" TO "research_contribution_edit_suggestion_reviewer_id_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_review" RENAME CONSTRAINT "research_contribution_review_contribution_fkey" TO "research_contribution_review_research_contribution_id_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_status_history" RENAME CONSTRAINT "research_contribution_status_history_changed_by_fkey" TO "research_contribution_status_history_changed_by_id_fkey";

-- RenameForeignKey
ALTER TABLE "research_contribution_status_history" RENAME CONSTRAINT "research_contribution_status_history_contribution_fkey" TO "research_contribution_status_history_research_contribution_fkey";

-- RenameForeignKey
ALTER TABLE "research_incentive_policy" RENAME CONSTRAINT "research_incentive_policy_created_by_fkey" TO "research_incentive_policy_created_by_id_fkey";

-- RenameForeignKey
ALTER TABLE "research_incentive_policy" RENAME CONSTRAINT "research_incentive_policy_updated_by_fkey" TO "research_incentive_policy_updated_by_id_fkey";

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_source_provisional_id_fkey" FOREIGN KEY ("source_provisional_id") REFERENCES "ipr_application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "research_contribution_applicant_details_contribution_key" RENAME TO "research_contribution_applicant_details_research_contributi_key";

-- RenameIndex
ALTER INDEX "research_contribution_author_contribution_id_idx" RENAME TO "research_contribution_author_research_contribution_id_idx";

-- RenameIndex
ALTER INDEX "research_contribution_author_contribution_uid_key" RENAME TO "research_contribution_author_research_contribution_id_uid_key";

-- RenameIndex
ALTER INDEX "research_contribution_edit_suggestion_contribution_id_idx" RENAME TO "research_contribution_edit_suggestion_research_contribution_idx";

-- RenameIndex
ALTER INDEX "research_contribution_review_contribution_id_idx" RENAME TO "research_contribution_review_research_contribution_id_idx";

-- RenameIndex
ALTER INDEX "research_contribution_status_history_contribution_id_idx" RENAME TO "research_contribution_status_history_research_contribution__idx";
