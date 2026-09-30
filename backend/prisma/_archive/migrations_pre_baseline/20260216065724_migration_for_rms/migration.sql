/*
  Warnings:

  - You are about to drop the column `assigned_department_ids` on the `role` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_school_ids` on the `role` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "club_status_enum" AS ENUM ('draft', 'pending_approval', 'approved', 'active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "club_lifecycle_state_enum" AS ENUM ('draft', 'under_approval', 'approved', 'active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "club_target_group_enum" AS ENUM ('all', 'ug', 'pg', 'phd');

-- CreateEnum
CREATE TYPE "club_visibility_enum" AS ENUM ('public', 'restricted');

-- CreateEnum
CREATE TYPE "club_meeting_frequency_enum" AS ENUM ('weekly', 'monthly', 'event_based');

-- CreateEnum
CREATE TYPE "club_change_type_enum" AS ENUM ('name_change', 'category_change', 'purpose_change', 'facilitator_change', 'vice_chairperson_change', 'governance_change', 'operational_change', 'other');

-- CreateEnum
CREATE TYPE "club_change_request_status_enum" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "note_status_enum" ADD VALUE 'reverted';

-- AlterTable
ALTER TABLE "note" ADD COLUMN     "club_academic_session" VARCHAR(64),
ADD COLUMN     "club_category_id" UUID,
ADD COLUMN     "club_estimated_annual_activity_count" INTEGER,
ADD COLUMN     "club_estimated_funding_amount" DECIMAL(12,2),
ADD COLUMN     "club_expected_activity_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "club_expected_student_strength" INTEGER,
ADD COLUMN     "club_faculty_facilitator_id" UUID,
ADD COLUMN     "club_funding_required" BOOLEAN,
ADD COLUMN     "club_infrastructure_requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "club_initial_members" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "club_meeting_frequency" "club_meeting_frequency_enum",
ADD COLUMN     "club_name" VARCHAR(256),
ADD COLUMN     "club_purpose" TEXT,
ADD COLUMN     "club_target_student_group" "club_target_group_enum",
ADD COLUMN     "club_vice_chairperson_id" UUID,
ADD COLUMN     "club_visibility" "club_visibility_enum";

-- AlterTable
ALTER TABLE "role" DROP COLUMN "assigned_department_ids",
DROP COLUMN "assigned_school_ids";

-- CreateTable
CREATE TABLE "club_category" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(64),
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "club_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "category_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "academic_session" VARCHAR(64) NOT NULL,
    "faculty_facilitator_id" UUID NOT NULL,
    "vice_chairperson_id" UUID NOT NULL,
    "target_student_group" "club_target_group_enum" NOT NULL,
    "expected_activity_types" TEXT[],
    "code_of_conduct_accepted" BOOLEAN NOT NULL,
    "anti_discrimination_accepted" BOOLEAN NOT NULL,
    "meeting_frequency" "club_meeting_frequency_enum" NOT NULL,
    "estimated_annual_activity_count" INTEGER NOT NULL,
    "infrastructure_requirements" TEXT[],
    "funding_required" BOOLEAN NOT NULL,
    "estimated_funding_amount" DECIMAL(12,2),
    "visibility" "club_visibility_enum" NOT NULL,
    "allow_internal_collaboration" BOOLEAN NOT NULL DEFAULT true,
    "allow_external_collaboration" BOOLEAN NOT NULL DEFAULT false,
    "proposed_email" VARCHAR(256),
    "social_media_handles" JSONB,
    "expected_student_strength" INTEGER,
    "status" "club_status_enum" NOT NULL DEFAULT 'draft',
    "lifecycle_state" "club_lifecycle_state_enum" NOT NULL DEFAULT 'draft',
    "noting_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_member" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "club_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_by_id" UUID NOT NULL,
    "removed_at" TIMESTAMPTZ(6),
    "removed_by_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "club_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_change_request" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "club_id" UUID NOT NULL,
    "noting_id" UUID NOT NULL,
    "change_type" "club_change_type_enum" NOT NULL,
    "requested_changes" JSONB NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "club_change_request_status_enum" NOT NULL DEFAULT 'pending',
    "requested_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "rejected_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_audit_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "club_id" UUID NOT NULL,
    "action" VARCHAR(128) NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "previous_state" JSONB,
    "new_state" JSONB,
    "changes" JSONB,
    "source" VARCHAR(64) NOT NULL DEFAULT 'dsw_ui',
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_category_parent_id_idx" ON "club_category"("parent_id");

-- CreateIndex
CREATE INDEX "club_category_is_active_idx" ON "club_category"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "club_category_name_parent_id_key" ON "club_category"("name", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "club_club_id_key" ON "club"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "club_name_key" ON "club"("name");

-- CreateIndex
CREATE UNIQUE INDEX "club_noting_id_key" ON "club"("noting_id");

-- CreateIndex
CREATE INDEX "club_status_idx" ON "club"("status");

-- CreateIndex
CREATE INDEX "club_lifecycle_state_idx" ON "club"("lifecycle_state");

-- CreateIndex
CREATE INDEX "club_category_id_idx" ON "club"("category_id");

-- CreateIndex
CREATE INDEX "club_faculty_facilitator_id_idx" ON "club"("faculty_facilitator_id");

-- CreateIndex
CREATE INDEX "club_vice_chairperson_id_idx" ON "club"("vice_chairperson_id");

-- CreateIndex
CREATE INDEX "club_academic_session_idx" ON "club"("academic_session");

-- CreateIndex
CREATE INDEX "club_created_at_idx" ON "club"("created_at");

-- CreateIndex
CREATE INDEX "club_member_club_id_idx" ON "club_member"("club_id");

-- CreateIndex
CREATE INDEX "club_member_student_id_idx" ON "club_member"("student_id");

-- CreateIndex
CREATE INDEX "club_member_is_active_idx" ON "club_member"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "club_member_club_id_student_id_key" ON "club_member"("club_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "club_change_request_noting_id_key" ON "club_change_request"("noting_id");

-- CreateIndex
CREATE INDEX "club_change_request_club_id_idx" ON "club_change_request"("club_id");

-- CreateIndex
CREATE INDEX "club_change_request_status_idx" ON "club_change_request"("status");

-- CreateIndex
CREATE INDEX "club_change_request_change_type_idx" ON "club_change_request"("change_type");

-- CreateIndex
CREATE INDEX "club_change_request_created_at_idx" ON "club_change_request"("created_at");

-- CreateIndex
CREATE INDEX "club_audit_log_club_id_idx" ON "club_audit_log"("club_id");

-- CreateIndex
CREATE INDEX "club_audit_log_action_idx" ON "club_audit_log"("action");

-- CreateIndex
CREATE INDEX "club_audit_log_performed_by_id_idx" ON "club_audit_log"("performed_by_id");

-- CreateIndex
CREATE INDEX "club_audit_log_created_at_idx" ON "club_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "note_status_idx" ON "note"("status");

-- CreateIndex
CREATE INDEX "note_category_subcategory_idx" ON "note"("category", "subcategory");

-- CreateIndex
CREATE INDEX "note_createdAt_idx" ON "note"("created_at");

-- CreateIndex
CREATE INDEX "note_createdById_idx" ON "note"("created_by_id");

-- CreateIndex
CREATE INDEX "note_currentHolderId_idx" ON "note"("current_holder_id");

-- CreateIndex
CREATE INDEX "note_status_createdById_idx" ON "note"("status", "created_by_id");

-- CreateIndex
CREATE INDEX "note_status_currentHolderId_idx" ON "note"("status", "current_holder_id");

-- CreateIndex
CREATE INDEX "note_updatedAt_idx" ON "note"("updated_at");

-- CreateIndex
CREATE INDEX "note_status_updatedAt_idx" ON "note"("status", "updated_at");

-- CreateIndex
CREATE INDEX "note_history_action_idx" ON "note_history"("action");

-- CreateIndex
CREATE INDEX "note_history_noteId_createdAt_idx" ON "note_history"("note_id", "created_at");

-- CreateIndex
CREATE INDEX "note_history_performedById_idx" ON "note_history"("performed_by_id");

-- CreateIndex
CREATE INDEX "note_history_performedById_createdAt_idx" ON "note_history"("performed_by_id", "created_at");

-- AddForeignKey
ALTER TABLE "club_category" ADD CONSTRAINT "club_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "club_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club" ADD CONSTRAINT "club_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "club_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club" ADD CONSTRAINT "club_faculty_facilitator_id_fkey" FOREIGN KEY ("faculty_facilitator_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club" ADD CONSTRAINT "club_vice_chairperson_id_fkey" FOREIGN KEY ("vice_chairperson_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club" ADD CONSTRAINT "club_noting_id_fkey" FOREIGN KEY ("noting_id") REFERENCES "note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_member" ADD CONSTRAINT "club_member_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_change_request" ADD CONSTRAINT "club_change_request_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_change_request" ADD CONSTRAINT "club_change_request_noting_id_fkey" FOREIGN KEY ("noting_id") REFERENCES "note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_change_request" ADD CONSTRAINT "club_change_request_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_change_request" ADD CONSTRAINT "club_change_request_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_change_request" ADD CONSTRAINT "club_change_request_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_audit_log" ADD CONSTRAINT "club_audit_log_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_audit_log" ADD CONSTRAINT "club_audit_log_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Note_eventName_idx" RENAME TO "note_eventName_idx";
