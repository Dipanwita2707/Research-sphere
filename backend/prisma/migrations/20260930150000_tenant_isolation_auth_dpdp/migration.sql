-- CreateEnum
CREATE TYPE "data_principal_request_type" AS ENUM ('access', 'correction', 'erasure', 'grievance', 'consent_withdrawal', 'nomination');

-- CreateEnum
CREATE TYPE "data_principal_request_status" AS ENUM ('submitted', 'in_review', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "breach_status" AS ENUM ('detected', 'contained', 'board_notified', 'principals_notified', 'closed');

-- DropForeignKey
ALTER TABLE "admission_faculty_staff" DROP CONSTRAINT "admission_faculty_staff_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "admission_staff_details" DROP CONSTRAINT "admission_staff_details_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "admission_staff_roles" DROP CONSTRAINT "admission_staff_roles_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "card" DROP CONSTRAINT "card_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "hr_non_teaching_staff_details" DROP CONSTRAINT "hr_non_teaching_staff_details_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "hr_non_teaching_staff_roles" DROP CONSTRAINT "hr_non_teaching_staff_roles_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "hr_teaching_staff_details" DROP CONSTRAINT "hr_teaching_staff_details_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "hr_teaching_staff_roles" DROP CONSTRAINT "hr_teaching_staff_roles_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_document" DROP CONSTRAINT "ipr_document_ipr_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_document" DROP CONSTRAINT "ipr_document_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "parent_details" DROP CONSTRAINT "parent_details_student_id_fkey";

-- DropForeignKey
ALTER TABLE "parent_details" DROP CONSTRAINT "parent_details_user_login_id_fkey";

-- DropForeignKey
ALTER TABLE "registrar_faculty_staff" DROP CONSTRAINT "registrar_faculty_staff_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "registrar_staff_details" DROP CONSTRAINT "registrar_staff_details_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "registrar_staff_roles" DROP CONSTRAINT "registrar_staff_roles_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "reissue_request" DROP CONSTRAINT "reissue_request_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "research_paper" DROP CONSTRAINT "research_paper_author_user_id_fkey";

-- DropForeignKey
ALTER TABLE "research_paper" DROP CONSTRAINT "research_paper_department_id_fkey";

-- DropForeignKey
ALTER TABLE "research_paper" DROP CONSTRAINT "research_paper_school_id_fkey";

-- DropForeignKey
ALTER TABLE "research_paper_review" DROP CONSTRAINT "research_paper_review_research_paper_id_fkey";

-- DropForeignKey
ALTER TABLE "research_paper_review" DROP CONSTRAINT "research_paper_review_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "research_paper_status_history" DROP CONSTRAINT "research_paper_status_history_changed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "research_paper_status_history" DROP CONSTRAINT "research_paper_status_history_research_paper_id_fkey";

-- DropIndex
DROP INDEX "department_department_code_key";

-- DropIndex
DROP INDEX "program_program_code_key";

-- AlterTable
ALTER TABLE "audit_report_config" ADD COLUMN     "university_id" UUID;

-- AlterTable
ALTER TABLE "audit_report_history" ADD COLUMN     "university_id" UUID;

-- AlterTable
ALTER TABLE "bug_report_screenshots" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "card" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "central_department_permission" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "changes_history" ADD COLUMN     "university_id" UUID;

-- AlterTable
ALTER TABLE "department" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "department_permission" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "document_change" ADD COLUMN     "university_id" UUID;

-- AlterTable
ALTER TABLE "employee_details" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "grant_application" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "grant_application_edit_suggestion" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "grant_application_review" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "grant_application_status_history" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "grant_consortium_organization" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "grant_investigator" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_applicant_details" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_application" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_collaborative_session" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_contributor" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_edit_suggestion" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_finance" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_review" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_sdg" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_status_history" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ipr_status_update" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "program" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "program_specialization" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "publication_import" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "publication_import_run" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "reissue_request" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "reporting_structure" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution_applicant_details" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution_author" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution_edit_suggestion" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution_review" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_contribution_status_history" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_profile_identity" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_progress_status_history" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "research_progress_tracker" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "section" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "student_details" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "universities" ADD COLUMN     "dpo_email" VARCHAR(256),
ADD COLUMN     "dpo_name" VARCHAR(256),
ADD COLUMN     "dpo_phone" VARCHAR(32),
ADD COLUMN     "require_guardian_consent_for_minors" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user_department_permission" ADD COLUMN     "university_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "user_login" ADD COLUMN     "anonymized_at" TIMESTAMPTZ(6),
ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ(6),
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(6),
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "admission_faculty_staff";

-- DropTable
DROP TABLE "admission_staff_details";

-- DropTable
DROP TABLE "admission_staff_roles";

-- DropTable
DROP TABLE "hr_non_teaching_staff_details";

-- DropTable
DROP TABLE "hr_non_teaching_staff_roles";

-- DropTable
DROP TABLE "hr_teaching_staff_details";

-- DropTable
DROP TABLE "hr_teaching_staff_roles";

-- DropTable
DROP TABLE "ipr_document";

-- DropTable
DROP TABLE "parent_details";

-- DropTable
DROP TABLE "registrar_faculty_staff";

-- DropTable
DROP TABLE "registrar_staff_details";

-- DropTable
DROP TABLE "registrar_staff_roles";

-- DropTable
DROP TABLE "research_paper";

-- DropTable
DROP TABLE "research_paper_review";

-- DropTable
DROP TABLE "research_paper_status_history";

-- CreateTable
CREATE TABLE "consent_notices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID,
    "version" VARCHAR(32) NOT NULL,
    "language" VARCHAR(8) NOT NULL DEFAULT 'en',
    "title" VARCHAR(256) NOT NULL,
    "content" TEXT NOT NULL,
    "purposes" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID,
    "user_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "purpose" VARCHAR(64) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMPTZ(6),
    "withdrawn_at" TIMESTAMPTZ(6),
    "given_by" VARCHAR(16) NOT NULL DEFAULT 'self',
    "guardian_name" VARCHAR(256),
    "guardian_email" VARCHAR(256),
    "guardian_relation" VARCHAR(64),
    "guardian_verified_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_principal_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID,
    "user_id" UUID NOT NULL,
    "type" "data_principal_request_type" NOT NULL,
    "status" "data_principal_request_status" NOT NULL DEFAULT 'submitted',
    "description" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "response" TEXT,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "handled_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_principal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_principal_nominees" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "email" VARCHAR(256),
    "phone" VARCHAR(32),
    "relation" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_principal_nominees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_breach_incidents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID,
    "title" VARCHAR(256) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'medium',
    "status" "breach_status" NOT NULL DEFAULT 'detected',
    "detected_at" TIMESTAMPTZ(6) NOT NULL,
    "board_report_due_at" TIMESTAMPTZ(6) NOT NULL,
    "board_notified_at" TIMESTAMPTZ(6),
    "principals_notified_at" TIMESTAMPTZ(6),
    "affected_count" INTEGER,
    "data_categories" JSONB NOT NULL DEFAULT '[]',
    "remediation" TEXT,
    "reported_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_breach_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID,
    "category" VARCHAR(64) NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "action" VARCHAR(16) NOT NULL DEFAULT 'anonymize',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_notices_university_id_is_active_idx" ON "consent_notices"("university_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "consent_notices_university_id_version_language_key" ON "consent_notices"("university_id", "version", "language");

-- CreateIndex
CREATE INDEX "consent_records_university_id_idx" ON "consent_records"("university_id");

-- CreateIndex
CREATE INDEX "consent_records_user_id_idx" ON "consent_records"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_user_id_notice_id_purpose_key" ON "consent_records"("user_id", "notice_id", "purpose");

-- CreateIndex
CREATE INDEX "data_principal_requests_university_id_status_idx" ON "data_principal_requests"("university_id", "status");

-- CreateIndex
CREATE INDEX "data_principal_requests_user_id_idx" ON "data_principal_requests"("user_id");

-- CreateIndex
CREATE INDEX "data_principal_requests_due_at_idx" ON "data_principal_requests"("due_at");

-- CreateIndex
CREATE UNIQUE INDEX "data_principal_nominees_user_id_key" ON "data_principal_nominees"("user_id");

-- CreateIndex
CREATE INDEX "data_principal_nominees_university_id_idx" ON "data_principal_nominees"("university_id");

-- CreateIndex
CREATE INDEX "data_breach_incidents_university_id_status_idx" ON "data_breach_incidents"("university_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_university_id_category_key" ON "data_retention_policies"("university_id", "category");

-- CreateIndex
CREATE INDEX "audit_report_config_university_id_idx" ON "audit_report_config"("university_id");

-- CreateIndex
CREATE INDEX "audit_report_history_university_id_idx" ON "audit_report_history"("university_id");

-- CreateIndex
CREATE INDEX "bug_report_screenshots_university_id_idx" ON "bug_report_screenshots"("university_id");

-- CreateIndex
CREATE INDEX "card_university_id_idx" ON "card"("university_id");

-- CreateIndex
CREATE INDEX "central_department_permission_university_id_idx" ON "central_department_permission"("university_id");

-- CreateIndex
CREATE INDEX "changes_history_university_id_idx" ON "changes_history"("university_id");

-- CreateIndex
CREATE INDEX "department_university_id_idx" ON "department"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_university_id_department_code_key" ON "department"("university_id", "department_code");

-- CreateIndex
CREATE INDEX "department_permission_university_id_idx" ON "department_permission"("university_id");

-- CreateIndex
CREATE INDEX "document_change_university_id_idx" ON "document_change"("university_id");

-- CreateIndex
CREATE INDEX "employee_details_university_id_idx" ON "employee_details"("university_id");

-- CreateIndex
CREATE INDEX "grant_application_university_id_idx" ON "grant_application"("university_id");

-- CreateIndex
CREATE INDEX "grant_application_edit_suggestion_university_id_idx" ON "grant_application_edit_suggestion"("university_id");

-- CreateIndex
CREATE INDEX "grant_application_review_university_id_idx" ON "grant_application_review"("university_id");

-- CreateIndex
CREATE INDEX "grant_application_status_history_university_id_idx" ON "grant_application_status_history"("university_id");

-- CreateIndex
CREATE INDEX "grant_consortium_organization_university_id_idx" ON "grant_consortium_organization"("university_id");

-- CreateIndex
CREATE INDEX "grant_investigator_university_id_idx" ON "grant_investigator"("university_id");

-- CreateIndex
CREATE INDEX "ipr_university_id_idx" ON "ipr"("university_id");

-- CreateIndex
CREATE INDEX "ipr_applicant_details_university_id_idx" ON "ipr_applicant_details"("university_id");

-- CreateIndex
CREATE INDEX "ipr_application_university_id_idx" ON "ipr_application"("university_id");

-- CreateIndex
CREATE INDEX "ipr_collaborative_session_university_id_idx" ON "ipr_collaborative_session"("university_id");

-- CreateIndex
CREATE INDEX "ipr_contributor_university_id_idx" ON "ipr_contributor"("university_id");

-- CreateIndex
CREATE INDEX "ipr_edit_suggestion_university_id_idx" ON "ipr_edit_suggestion"("university_id");

-- CreateIndex
CREATE INDEX "ipr_finance_university_id_idx" ON "ipr_finance"("university_id");

-- CreateIndex
CREATE INDEX "ipr_review_university_id_idx" ON "ipr_review"("university_id");

-- CreateIndex
CREATE INDEX "ipr_sdg_university_id_idx" ON "ipr_sdg"("university_id");

-- CreateIndex
CREATE INDEX "ipr_status_history_university_id_idx" ON "ipr_status_history"("university_id");

-- CreateIndex
CREATE INDEX "ipr_status_update_university_id_idx" ON "ipr_status_update"("university_id");

-- CreateIndex
CREATE INDEX "program_university_id_idx" ON "program"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_university_id_program_code_key" ON "program"("university_id", "program_code");

-- CreateIndex
CREATE INDEX "program_specialization_university_id_idx" ON "program_specialization"("university_id");

-- CreateIndex
CREATE INDEX "publication_import_university_id_idx" ON "publication_import"("university_id");

-- CreateIndex
CREATE INDEX "publication_import_run_university_id_idx" ON "publication_import_run"("university_id");

-- CreateIndex
CREATE INDEX "reissue_request_university_id_idx" ON "reissue_request"("university_id");

-- CreateIndex
CREATE INDEX "reporting_structure_university_id_idx" ON "reporting_structure"("university_id");

-- CreateIndex
CREATE INDEX "research_contribution_university_id_idx" ON "research_contribution"("university_id");

-- CreateIndex
CREATE INDEX "research_contribution_applicant_details_university_id_idx" ON "research_contribution_applicant_details"("university_id");

-- CreateIndex
CREATE INDEX "research_contribution_author_university_id_idx" ON "research_contribution_author"("university_id");

-- CreateIndex
CREATE INDEX "research_contribution_edit_suggestion_university_id_idx" ON "research_contribution_edit_suggestion"("university_id");

-- CreateIndex
CREATE INDEX "research_contribution_review_university_id_idx" ON "research_contribution_review"("university_id");

-- CreateIndex
CREATE INDEX "research_contribution_status_history_university_id_idx" ON "research_contribution_status_history"("university_id");

-- CreateIndex
CREATE INDEX "research_profile_identity_university_id_idx" ON "research_profile_identity"("university_id");

-- CreateIndex
CREATE INDEX "research_progress_status_history_university_id_idx" ON "research_progress_status_history"("university_id");

-- CreateIndex
CREATE INDEX "research_progress_tracker_university_id_idx" ON "research_progress_tracker"("university_id");

-- CreateIndex
CREATE INDEX "section_university_id_idx" ON "section"("university_id");

-- CreateIndex
CREATE INDEX "student_details_university_id_idx" ON "student_details"("university_id");

-- CreateIndex
CREATE INDEX "user_department_permission_university_id_idx" ON "user_department_permission"("university_id");

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_report_config" ADD CONSTRAINT "audit_report_config_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_report_history" ADD CONSTRAINT "audit_report_history_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changes_history" ADD CONSTRAINT "changes_history_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_permission" ADD CONSTRAINT "user_department_permission_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_permission" ADD CONSTRAINT "department_permission_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department_permission" ADD CONSTRAINT "central_department_permission_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program" ADD CONSTRAINT "program_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_specialization" ADD CONSTRAINT "program_specialization_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_applicant_details" ADD CONSTRAINT "ipr_applicant_details_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_contributor" ADD CONSTRAINT "ipr_contributor_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_sdg" ADD CONSTRAINT "ipr_sdg_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_review" ADD CONSTRAINT "ipr_review_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_edit_suggestion" ADD CONSTRAINT "ipr_edit_suggestion_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_collaborative_session" ADD CONSTRAINT "ipr_collaborative_session_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_history" ADD CONSTRAINT "ipr_status_history_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_finance" ADD CONSTRAINT "ipr_finance_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr" ADD CONSTRAINT "ipr_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_change" ADD CONSTRAINT "document_change_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_profile_identity" ADD CONSTRAINT "research_profile_identity_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_import_run" ADD CONSTRAINT "publication_import_run_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_import" ADD CONSTRAINT "publication_import_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_applicant_details" ADD CONSTRAINT "research_contribution_applicant_details_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_author" ADD CONSTRAINT "research_contribution_author_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_review" ADD CONSTRAINT "research_contribution_review_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_status_history" ADD CONSTRAINT "research_contribution_status_history_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_edit_suggestion" ADD CONSTRAINT "research_contribution_edit_suggestion_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_status_history" ADD CONSTRAINT "research_progress_status_history_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application" ADD CONSTRAINT "grant_application_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_consortium_organization" ADD CONSTRAINT "grant_consortium_organization_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_investigator" ADD CONSTRAINT "grant_investigator_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_review" ADD CONSTRAINT "grant_application_review_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_status_history" ADD CONSTRAINT "grant_application_status_history_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_edit_suggestion" ADD CONSTRAINT "grant_application_edit_suggestion_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_structure" ADD CONSTRAINT "reporting_structure_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_report_screenshots" ADD CONSTRAINT "bug_report_screenshots_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_notices" ADD CONSTRAINT "consent_notices_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "consent_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_principal_requests" ADD CONSTRAINT "data_principal_requests_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_principal_requests" ADD CONSTRAINT "data_principal_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_principal_requests" ADD CONSTRAINT "data_principal_requests_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_principal_nominees" ADD CONSTRAINT "data_principal_nominees_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_principal_nominees" ADD CONSTRAINT "data_principal_nominees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_breach_incidents" ADD CONSTRAINT "data_breach_incidents_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_breach_incidents" ADD CONSTRAINT "data_breach_incidents_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

