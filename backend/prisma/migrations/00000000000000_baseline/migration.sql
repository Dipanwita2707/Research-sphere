-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "RoleDepartmentType" AS ENUM ('SCHOOL', 'CENTRAL', 'BOTH');

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
CREATE TYPE "user_role_enum" AS ENUM ('superadmin', 'admin', 'student', 'faculty', 'staff', 'parent');

-- CreateEnum
CREATE TYPE "card_status_enum" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "reissue_reason_enum" AS ENUM ('lost', 'damaged', 'stolen', 'defective', 'other');

-- CreateEnum
CREATE TYPE "reissue_request_status_enum" AS ENUM ('pending', 'approved', 'rejected', 'completed');

-- CreateEnum
CREATE TYPE "faculty_type_enum" AS ENUM ('engineering', 'management', 'arts', 'science', 'medical', 'law', 'other');

-- CreateEnum
CREATE TYPE "program_type_enum" AS ENUM ('undergraduate', 'postgraduate', 'doctoral', 'diploma', 'certificate');

-- CreateEnum
CREATE TYPE "fee_type_enum" AS ENUM ('TRANSPORT', 'HOSTEL', 'ACADEMIC');

-- CreateEnum
CREATE TYPE "section_status_enum" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "department_enum" AS ENUM ('ADMISSION', 'REGISTRAR', 'HR_TEACHING', 'HR_NON_TEACHING');

-- CreateEnum
CREATE TYPE "ipr_type_enum" AS ENUM ('patent', 'copyright', 'trademark', 'design');

-- CreateEnum
CREATE TYPE "ipr_filing_type_enum" AS ENUM ('provisional', 'complete');

-- CreateEnum
CREATE TYPE "ipr_status_enum" AS ENUM ('draft', 'submitted', 'under_drd_review', 'changes_required', 'resubmitted', 'recommended_to_head', 'drd_head_approved', 'drd_rejected', 'submitted_to_govt', 'govt_application_filed', 'published', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed', 'cancelled', 'govt_rejected', 'drd_head_rejected', 'pending_mentor_approval');

-- CreateEnum
CREATE TYPE "edit_suggestion_status_enum" AS ENUM ('pending', 'accepted', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "applicant_type_enum" AS ENUM ('internal_faculty', 'internal_student', 'internal_staff', 'external_academic', 'external_industry', 'external_other');

-- CreateEnum
CREATE TYPE "project_type_enum" AS ENUM ('phd', 'pg_project', 'ug_project', 'faculty_research', 'industry_collaboration', 'any_other');

-- CreateEnum
CREATE TYPE "research_paper_status_enum" AS ENUM ('draft', 'submitted', 'under_review', 'changes_required', 'resubmitted', 'approved');

-- CreateEnum
CREATE TYPE "research_publication_type_enum" AS ENUM ('research_paper', 'book', 'book_chapter', 'conference_paper', 'grant_proposal');

-- CreateEnum
CREATE TYPE "research_contribution_status_enum" AS ENUM ('draft', 'submitted', 'under_review', 'changes_required', 'resubmitted', 'approved', 'rejected', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "research_author_type_enum" AS ENUM ('first_author', 'corresponding_author', 'co_author', 'first_and_corresponding_author');

-- CreateEnum
CREATE TYPE "distribution_method_enum" AS ENUM ('author_role_based', 'author_position_based');

-- CreateEnum
CREATE TYPE "quartile_enum" AS ENUM ('Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('resolved', 'unresolved');

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "logo_url" VARCHAR(512),
    "primary_color" VARCHAR(16),
    "contact_email" VARCHAR(256),
    "website_url" VARCHAR(512),
    "address" TEXT,
    "city" VARCHAR(128),
    "state" VARCHAR(128),
    "country" VARCHAR(64) DEFAULT 'India',
    "timezone" VARCHAR(64) DEFAULT 'Asia/Kolkata',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trial_ends_at" TIMESTAMPTZ(6),
    "affiliation_aliases" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_tiers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(128) NOT NULL,
    "monthly_price_cents" INTEGER NOT NULL,
    "yearly_price_cents" INTEGER NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_api_calls_per_month" INTEGER NOT NULL,
    "max_storage_gb" INTEGER NOT NULL DEFAULT 10,
    "features" JSONB NOT NULL DEFAULT '{}',
    "overage_per_1k_calls" INTEGER NOT NULL DEFAULT 10,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'trialing',
    "billing_cycle" VARCHAR(16) NOT NULL DEFAULT 'monthly',
    "current_period_start" DATE NOT NULL,
    "current_period_end" DATE NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "external_payment_id" VARCHAR(256),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_daily" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "success_requests" INTEGER NOT NULL DEFAULT 0,
    "error_requests" INTEGER NOT NULL DEFAULT 0,
    "avg_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "p95_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "unique_users" INTEGER NOT NULL DEFAULT 0,
    "billable_units" INTEGER NOT NULL DEFAULT 0,
    "billable_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "endpoint_breakdown" JSONB NOT NULL DEFAULT '{}',
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_login" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "uid" VARCHAR(32) NOT NULL,
    "email" CITEXT,
    "phone" VARCHAR(20),
    "profile_image_file_path" TEXT,
    "profile_image" VARCHAR(64),
    "password_hash" TEXT NOT NULL,
    "role" "user_role_enum" NOT NULL,
    "assigned_role_ids" JSONB DEFAULT '[]',
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "university_id" UUID,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_login_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_login_id" UUID,
    "first_name" VARCHAR(128) NOT NULL,
    "last_name" VARCHAR(128),
    "display_name" VARCHAR(256),
    "photo_file_path" TEXT,
    "photo" VARCHAR(64),
    "emp_id" VARCHAR(64),
    "designation" VARCHAR(128),
    "join_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primary_central_dept_id" UUID,
    "primary_department_id" UUID,
    "email" VARCHAR(256),
    "phone_number" VARCHAR(20),
    "primary_school_id" UUID,
    "officer_level" VARCHAR(10),

    CONSTRAINT "employee_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "card_holder_type" VARCHAR(32) NOT NULL,
    "employee_id" UUID,
    "student_id" UUID,
    "parent_id" UUID,
    "rfid_uid" VARCHAR(128),
    "rfid_approved" BOOLEAN NOT NULL DEFAULT false,
    "rfid_reissue" BOOLEAN NOT NULL DEFAULT false,
    "rfid_reissue_count" INTEGER NOT NULL DEFAULT 0,
    "rfid_updatedetail" BOOLEAN NOT NULL DEFAULT false,
    "rfid_image" VARCHAR(64),
    "rfid_issue_images" VARCHAR(64),
    "latest_image_file_path" TEXT,
    "photo_file_path" TEXT,
    "photo" VARCHAR(64),
    "template_color_code" VARCHAR(32),
    "issued_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "status" "card_status_enum" NOT NULL DEFAULT 'active',
    "issued_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reissue_request" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "card_holder_type" VARCHAR(32) NOT NULL,
    "employee_id" UUID,
    "student_id" UUID,
    "parent_id" UUID,
    "old_card_id" UUID,
    "reason" TEXT,
    "reason_code" VARCHAR(64),
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "proof_file_path" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "requested_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reissue_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "actor_id" UUID,
    "university_id" UUID,
    "action" VARCHAR(256) NOT NULL,
    "target_table" VARCHAR(128),
    "target_id" UUID,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action_type" "AuditActionType" NOT NULL DEFAULT 'OTHER',
    "category" VARCHAR(64),
    "duration" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "module" VARCHAR(64),
    "new_values" JSONB,
    "old_values" JSONB,
    "request_method" VARCHAR(10),
    "request_path" VARCHAR(512),
    "response_status" INTEGER,
    "session_id" VARCHAR(256),
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "changes_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "table_id" UUID NOT NULL,
    "table_name" VARCHAR(128) NOT NULL,
    "column_name" VARCHAR(128) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by_id" UUID NOT NULL,
    "change_type" VARCHAR(32) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changes_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_staff_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "can_view_all" BOOLEAN NOT NULL DEFAULT false,
    "can_modify_all" BOOLEAN NOT NULL DEFAULT false,
    "special_permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_staff_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "work_location" VARCHAR(256),
    "supervisor" VARCHAR(256),
    "responsible_for" VARCHAR(256),
    "admission_cycle" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_staff_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_faculty_staff" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "faculty_type" VARCHAR(128),
    "qualification" VARCHAR(256),
    "experience" VARCHAR(256),
    "specialization" VARCHAR(256),
    "responsibilities" VARCHAR(512),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_faculty_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrar_staff_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "can_view_all" BOOLEAN NOT NULL DEFAULT false,
    "can_modify_all" BOOLEAN NOT NULL DEFAULT false,
    "special_permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrar_staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrar_staff_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "work_location" VARCHAR(256),
    "supervisor" VARCHAR(256),
    "responsible_for" VARCHAR(256),
    "access_level" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrar_staff_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrar_faculty_staff" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "faculty_type" VARCHAR(128),
    "qualification" VARCHAR(256),
    "experience" VARCHAR(256),
    "specialization" VARCHAR(256),
    "responsibilities" VARCHAR(512),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrar_faculty_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_teaching_staff_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "can_view_all" BOOLEAN NOT NULL DEFAULT false,
    "can_modify_all" BOOLEAN NOT NULL DEFAULT false,
    "special_permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_teaching_staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_non_teaching_staff_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "can_view_all" BOOLEAN NOT NULL DEFAULT false,
    "can_modify_all" BOOLEAN NOT NULL DEFAULT false,
    "special_permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_non_teaching_staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_teaching_staff_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "qualification" VARCHAR(256),
    "experience" VARCHAR(256),
    "specialization" VARCHAR(256),
    "current_posting" VARCHAR(256),
    "salary_grade" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_teaching_staff_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_non_teaching_staff_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "qualification" VARCHAR(256),
    "experience" VARCHAR(256),
    "skill_set" VARCHAR(256),
    "current_posting" VARCHAR(256),
    "salary_grade" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_non_teaching_staff_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_department_permission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "department" "department_enum" NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_department_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_permission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "central_department_permission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "central_dept_id" UUID NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_school_ids" JSONB NOT NULL DEFAULT '[]',
    "assigned_research_school_ids" JSONB DEFAULT '[]',
    "assigned_book_school_ids" JSONB DEFAULT '[]',
    "assigned_conference_school_ids" JSONB DEFAULT '[]',
    "assigned_grant_school_ids" JSONB DEFAULT '[]',
    "assigned_monthly_report_department_ids" JSONB DEFAULT '[]',
    "assigned_monthly_report_school_ids" JSONB DEFAULT '[]',

    CONSTRAINT "central_department_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_school_list" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "faculty_code" VARCHAR(32) NOT NULL,
    "faculty_name" VARCHAR(256) NOT NULL,
    "faculty_type" "faculty_type_enum" NOT NULL,
    "short_name" VARCHAR(64),
    "description" TEXT,
    "established_year" INTEGER,
    "head_of_faculty" UUID,
    "contact_email" CITEXT,
    "contact_phone" VARCHAR(20),
    "office_location" TEXT,
    "website_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_school_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "faculty_id" UUID NOT NULL,
    "department_code" VARCHAR(32) NOT NULL,
    "department_name" VARCHAR(256) NOT NULL,
    "short_name" VARCHAR(64),
    "description" TEXT,
    "established_year" INTEGER,
    "head_of_department" UUID,
    "contact_email" CITEXT,
    "contact_phone" VARCHAR(20),
    "office_location" TEXT,
    "budget_allocation" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "central_department" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "department_code" VARCHAR(32) NOT NULL,
    "department_name" VARCHAR(256) NOT NULL,
    "short_name" VARCHAR(64),
    "description" TEXT,
    "head_of_department" UUID,
    "contact_email" CITEXT,
    "contact_phone" VARCHAR(20),
    "office_location" TEXT,
    "department_type" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID,
    "role_code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "department_type" "RoleDepartmentType" NOT NULL DEFAULT 'BOTH',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "requires_department_assignment" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "department_id" UUID NOT NULL,
    "program_code" VARCHAR(32) NOT NULL,
    "program_name" VARCHAR(256) NOT NULL,
    "program_type" "program_type_enum" NOT NULL,
    "short_name" VARCHAR(64),
    "description" TEXT,
    "duration_years" INTEGER NOT NULL DEFAULT 4,
    "duration_months" INTEGER,
    "duration_semesters" INTEGER NOT NULL DEFAULT 8,
    "total_credits" INTEGER,
    "admission_capacity" INTEGER NOT NULL DEFAULT 0,
    "current_enrollment" INTEGER NOT NULL DEFAULT 0,
    "program_coordinator" UUID,
    "accreditation_body" VARCHAR(128),
    "accreditation_status" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_specialization" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "specialization_code" VARCHAR(64) NOT NULL,
    "specialization_name" VARCHAR(256) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_specialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "program_id" UUID NOT NULL,
    "section_code" VARCHAR(32) NOT NULL,
    "section_name" VARCHAR(128) NOT NULL,
    "academic_year" VARCHAR(16) NOT NULL,
    "semester" INTEGER NOT NULL,
    "batch_year" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 60,
    "current_strength" INTEGER NOT NULL DEFAULT 0,
    "class_teacher" UUID,
    "room_number" VARCHAR(64),
    "timetable_slot" VARCHAR(32),
    "status" "section_status_enum" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_login_id" UUID,
    "student_id" VARCHAR(64) NOT NULL,
    "first_name" VARCHAR(128) NOT NULL,
    "last_name" VARCHAR(128),
    "display_name" VARCHAR(256),
    "registration_no" VARCHAR(64),
    "middle_name" VARCHAR(128),
    "email" VARCHAR(256),
    "phone" VARCHAR(15),
    "photo_file_path" TEXT,
    "photo" VARCHAR(64),
    "section_id" UUID,
    "program_id" UUID,
    "roll_number" VARCHAR(32),
    "admission_date" DATE,
    "graduation_date" DATE,
    "current_semester" INTEGER NOT NULL DEFAULT 1,
    "cgpa" DECIMAL(4,2),
    "attendance_percentage" DECIMAL(5,2),
    "parent_contact" VARCHAR(20),
    "emergency_contact" VARCHAR(20),
    "address" TEXT,
    "date_of_birth" DATE,
    "gender" VARCHAR(16),
    "blood_group" VARCHAR(8),
    "data_entry_status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "data_approved_by" UUID,
    "data_approved_at" TIMESTAMPTZ(6),
    "approval_comments" TEXT,
    "photo_capture_allowed" BOOLEAN NOT NULL DEFAULT false,
    "card_print_allowed" BOOLEAN NOT NULL DEFAULT false,
    "photo_path" VARCHAR(512),
    "photo_captured_at" TIMESTAMPTZ(6),
    "photo_captured_by" UUID,
    "nationality" VARCHAR(100),
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mentor_id" UUID,

    CONSTRAINT "student_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_login_id" UUID,
    "student_id" UUID NOT NULL,
    "relationship" VARCHAR(32) NOT NULL,
    "first_name" VARCHAR(128) NOT NULL,
    "last_name" VARCHAR(128),
    "occupation" VARCHAR(128),
    "organization" VARCHAR(256),
    "phone" VARCHAR(20),
    "email" CITEXT,
    "address" TEXT,
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_application" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "applicant_user_id" UUID,
    "applicant_type" "applicant_type_enum" NOT NULL,
    "ipr_type" "ipr_type_enum" NOT NULL,
    "project_type" "project_type_enum" NOT NULL,
    "filing_type" "ipr_filing_type_enum" NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "description" TEXT NOT NULL,
    "remarks" TEXT,
    "school_id" UUID,
    "department_id" UUID,
    "current_reviewer_id" UUID,
    "annexure_file_path" TEXT,
    "supporting_docs_file_paths" JSONB,
    "incentive_amount" DECIMAL(15,2),
    "points_awarded" INTEGER,
    "credited_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "govt_application_id" VARCHAR(128),
    "govt_filing_date" TIMESTAMPTZ(6),
    "publication_date" TIMESTAMPTZ(6),
    "publication_id" VARCHAR(128),
    "status" "ipr_status_enum" NOT NULL DEFAULT 'draft',
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "application_number" VARCHAR(32),
    "conversion_date" TIMESTAMPTZ(6),
    "prototype_file_path" TEXT,
    "source_provisional_id" UUID,

    CONSTRAINT "ipr_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_applicant_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "employee_category" VARCHAR(64),
    "employee_type" VARCHAR(64),
    "uid" VARCHAR(64),
    "email" VARCHAR(256),
    "phone" VARCHAR(20),
    "university_dept_name" VARCHAR(256),
    "external_name" VARCHAR(256),
    "external_option" VARCHAR(64),
    "institute_type" VARCHAR(64),
    "company_university_name" VARCHAR(256),
    "external_email" VARCHAR(256),
    "external_phone" VARCHAR(20),
    "external_address" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventor_email" VARCHAR(256),
    "inventor_name" VARCHAR(256),
    "inventor_phone" VARCHAR(20),
    "inventor_uid" VARCHAR(64),
    "is_inventor" BOOLEAN NOT NULL DEFAULT false,
    "mentor_name" VARCHAR(256),
    "mentor_uid" VARCHAR(64),

    CONSTRAINT "ipr_applicant_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_contributor" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "user_id" UUID,
    "uid" VARCHAR(64),
    "name" VARCHAR(256) NOT NULL,
    "email" VARCHAR(256),
    "phone" VARCHAR(20),
    "department" VARCHAR(256),
    "employee_category" VARCHAR(64),
    "employee_type" VARCHAR(64),
    "role" VARCHAR(64) NOT NULL DEFAULT 'inventor',
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_contributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_sdg" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "sdg_code" VARCHAR(16) NOT NULL,
    "sdg_title" VARCHAR(256),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_sdg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_review" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewer_role" VARCHAR(64) NOT NULL,
    "comments" TEXT,
    "edits" JSONB,
    "decision" VARCHAR(32) NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "has_suggestions" BOOLEAN NOT NULL DEFAULT false,
    "suggestions_count" INTEGER NOT NULL DEFAULT 0,
    "pending_suggestions_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ipr_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_edit_suggestion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
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

    CONSTRAINT "ipr_edit_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_collaborative_session" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "session_data" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_collaborative_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "comments" TEXT,
    "metadata" JSONB,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_status" "ipr_status_enum",
    "to_status" "ipr_status_enum" NOT NULL,

    CONSTRAINT "ipr_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_finance" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "finance_reviewer_id" UUID NOT NULL,
    "audit_status" VARCHAR(64) NOT NULL,
    "audit_comments" TEXT,
    "incentive_amount" DECIMAL(15,2) NOT NULL,
    "points_awarded" INTEGER,
    "payment_reference" VARCHAR(128),
    "credited_to_account" VARCHAR(128),
    "approved_at" TIMESTAMPTZ(6),
    "credited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_finance_pkey" PRIMARY KEY ("id")
);

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
    "university_id" UUID NOT NULL,
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
    "affiliation_override" VARCHAR(256),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_paper" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "author_user_id" UUID NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "abstract" TEXT NOT NULL,
    "keywords" VARCHAR(512),
    "journal_name" VARCHAR(256),
    "issn" VARCHAR(32),
    "impact_factor" DECIMAL(5,2),
    "publication_date" DATE,
    "doi" VARCHAR(128),
    "school_id" UUID,
    "department_id" UUID,
    "status" "research_paper_status_enum" NOT NULL DEFAULT 'draft',
    "current_reviewer_id" UUID,
    "manuscript_file_path" TEXT,
    "supporting_docs_file_paths" JSONB,
    "incentive_amount" DECIMAL(15,2),
    "points_awarded" INTEGER,
    "credited_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_paper_review" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_paper_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "comments" TEXT,
    "edits" JSONB,
    "decision" VARCHAR(32) NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_paper_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_paper_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_paper_id" UUID NOT NULL,
    "from_status" "research_paper_status_enum",
    "to_status" "research_paper_status_enum" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "comments" TEXT,
    "metadata" JSONB,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_paper_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "application_number" VARCHAR(100),
    "submission_date" TIMESTAMPTZ(6),
    "applicant" VARCHAR(255) NOT NULL,
    "co_applicants" JSONB,
    "department" VARCHAR(100) NOT NULL,
    "research_area" VARCHAR(255),
    "keywords" JSONB,
    "technical_specifications" TEXT,
    "estimated_value" DECIMAL(15,2),
    "market_potential" TEXT,
    "competitive_advantage" TEXT,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "review_comments" TEXT,
    "reviewer_notes" TEXT,
    "review_date" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_document" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_change" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "original_text" TEXT,
    "new_text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "reviewer_id" UUID NOT NULL,
    "comment" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "university_id" UUID,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_contribution" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_number" VARCHAR(32),
    "applicant_user_id" UUID,
    "applicant_type" "applicant_type_enum" NOT NULL,
    "publication_type" "research_publication_type_enum" NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "abstract" TEXT,
    "keywords" VARCHAR(512),
    "school_id" UUID,
    "department_id" UUID,
    "status" "research_contribution_status_enum" NOT NULL DEFAULT 'draft',
    "current_reviewer_id" UUID,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "international_author" BOOLEAN DEFAULT false,
    "foreign_collaborations_count" INTEGER DEFAULT 0,
    "impact_factor" DECIMAL(10,4),
    "sjr" DECIMAL(10,4),
    "interdisciplinary_from_sgt" BOOLEAN DEFAULT false,
    "students_from_sgt" BOOLEAN DEFAULT false,
    "journal_name" VARCHAR(512),
    "total_authors" INTEGER DEFAULT 1,
    "sgt_affiliated_authors" INTEGER DEFAULT 1,
    "internal_co_authors" INTEGER DEFAULT 0,
    "issue" VARCHAR(64),
    "page_numbers" VARCHAR(64),
    "doi" VARCHAR(256),
    "issn" VARCHAR(32),
    "publisher_name" VARCHAR(256),
    "isbn" VARCHAR(32),
    "edition" VARCHAR(64),
    "chapter_number" VARCHAR(32),
    "book_title" VARCHAR(512),
    "editors" VARCHAR(512),
    "publisher_location" VARCHAR(256),
    "conference_name" VARCHAR(512),
    "conference_location" VARCHAR(256),
    "conference_date" DATE,
    "proceedings_title" VARCHAR(512),
    "funding_agency" VARCHAR(256),
    "proposal_type" VARCHAR(64),
    "requested_amount" DECIMAL(15,2),
    "sanctioned_amount" DECIMAL(15,2),
    "project_duration_months" INTEGER,
    "project_start_date" DATE,
    "project_end_date" DATE,
    "publication_date" DATE,
    "publication_status" VARCHAR(64),
    "manuscript_file_path" VARCHAR(512),
    "supporting_docs_file_paths" JSONB,
    "indexing_details" JSONB DEFAULT '{}',
    "calculated_incentive_amount" DECIMAL(15,2),
    "calculated_points" INTEGER,
    "incentive_amount" DECIMAL(15,2),
    "points_awarded" INTEGER,
    "credited_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "national_international" VARCHAR(32),
    "book_publication_type" VARCHAR(32),
    "communicated_with_official_id" BOOLEAN NOT NULL DEFAULT true,
    "faculty_remarks" TEXT,
    "book_indexing_type" VARCHAR(32),
    "book_letter" VARCHAR(8),
    "personal_email" VARCHAR(256),
    "conference_sub_type" VARCHAR(64),
    "proceedings_quartile" VARCHAR(16),
    "total_presenters" INTEGER DEFAULT 1,
    "is_presenter" BOOLEAN DEFAULT false,
    "virtual_conference" BOOLEAN DEFAULT false,
    "full_paper" BOOLEAN DEFAULT false,
    "conference_held_at_sgt" BOOLEAN DEFAULT false,
    "conference_best_paper_award" BOOLEAN DEFAULT false,
    "industry_collaboration" BOOLEAN DEFAULT false,
    "central_facility_used" BOOLEAN DEFAULT false,
    "issn_isbn_issue_no" VARCHAR(64),
    "paper_doi" VARCHAR(256),
    "weblink" VARCHAR(512),
    "priority_funding_area" VARCHAR(256),
    "conference_role" VARCHAR(64),
    "indexed_in" VARCHAR(32),
    "conference_held_location" VARCHAR(32),
    "venue" VARCHAR(512),
    "topic" VARCHAR(512),
    "attended_virtual" BOOLEAN DEFAULT false,
    "event_category" VARCHAR(32),
    "organizer_role" VARCHAR(64),
    "conference_type" VARCHAR(32),
    "paperweblink" VARCHAR(512),
    "distribution_method_used" "distribution_method_enum",
    "indexing_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quartile" "quartile_enum",
    "sdg_goals" TEXT[],
    "naas_rating" DECIMAL(4,2),
    "subsidiary_impact_factor" DECIMAL(10,4),
    "volume" VARCHAR(64),
    "source_type" VARCHAR(32),
    "source_systems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "external_ids" JSONB DEFAULT '{}',
    "imported_at" TIMESTAMPTZ(6),
    "last_synced_at" TIMESTAMPTZ(6),
    "special_review_required" BOOLEAN DEFAULT false,
    "import_confidence" DECIMAL(5,2),
    "missing_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "auto_calculated_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "field_provenance" JSONB DEFAULT '{}',
    "import_metadata" JSONB DEFAULT '{}',

    CONSTRAINT "research_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_profile_identity" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "orcid" VARCHAR(32),
    "scopus_author_id" VARCHAR(64),
    "pubmed_id" VARCHAR(64),
    "web_of_science_id" VARCHAR(64),
    "affiliation_aliases" JSONB DEFAULT '[]',
    "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "filter_sgt_only" BOOLEAN NOT NULL DEFAULT false,
    "sync_frequency_days" INTEGER NOT NULL DEFAULT 1,
    "sync_status" VARCHAR(32) NOT NULL DEFAULT 'never_synced',
    "sync_error" TEXT,
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_profile_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_import_run" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_profile_id" UUID NOT NULL,
    "triggered_by_id" UUID,
    "trigger_type" VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    "source_systems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "discovered_count" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "special_review_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "error_summary" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "publication_import_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_import" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_profile_id" UUID NOT NULL,
    "research_contribution_id" UUID,
    "source_system" VARCHAR(32) NOT NULL,
    "external_id" VARCHAR(191) NOT NULL,
    "doi" VARCHAR(256),
    "published_year" INTEGER,
    "normalized_title" VARCHAR(512),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "publication_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_contribution_applicant_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_contribution_id" UUID NOT NULL,
    "employee_category" VARCHAR(64),
    "employee_type" VARCHAR(64),
    "uid" VARCHAR(64),
    "email" VARCHAR(256),
    "phone" VARCHAR(20),
    "university_dept_name" VARCHAR(256),
    "mentor_name" VARCHAR(256),
    "mentor_uid" VARCHAR(64),
    "is_phd_work" BOOLEAN DEFAULT false,
    "phd_title" VARCHAR(512),
    "phd_objectives" TEXT,
    "covered_objectives" VARCHAR(256),
    "addresses_societal" BOOLEAN DEFAULT false,
    "addresses_government" BOOLEAN DEFAULT false,
    "addresses_environmental" BOOLEAN DEFAULT false,
    "addresses_industrial" BOOLEAN DEFAULT false,
    "addresses_business" BOOLEAN DEFAULT false,
    "addresses_conceptual" BOOLEAN DEFAULT false,
    "enriches_discipline" BOOLEAN DEFAULT false,
    "is_newsworthy" BOOLEAN DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_contribution_applicant_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_contribution_author" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_contribution_id" UUID NOT NULL,
    "user_id" UUID,
    "uid" VARCHAR(64),
    "registration_no" VARCHAR(64),
    "name" VARCHAR(256) NOT NULL,
    "email" VARCHAR(256),
    "phone" VARCHAR(20),
    "affiliation" VARCHAR(256),
    "department" VARCHAR(256),
    "author_order" INTEGER NOT NULL DEFAULT 1,
    "is_corresponding" BOOLEAN NOT NULL DEFAULT false,
    "author_type" "research_author_type_enum" NOT NULL DEFAULT 'co_author',
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "author_category" VARCHAR(64),
    "is_phd_work" BOOLEAN DEFAULT false,
    "phd_title" VARCHAR(512),
    "phd_objectives" TEXT,
    "covered_objectives" VARCHAR(256),
    "addresses_societal" BOOLEAN DEFAULT false,
    "addresses_government" BOOLEAN DEFAULT false,
    "addresses_environmental" BOOLEAN DEFAULT false,
    "addresses_industrial" BOOLEAN DEFAULT false,
    "addresses_business" BOOLEAN DEFAULT false,
    "addresses_conceptual" BOOLEAN DEFAULT false,
    "is_newsworthy" BOOLEAN DEFAULT false,
    "incentive_share" DECIMAL(15,2),
    "points_share" INTEGER,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "designation" VARCHAR(256),
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "author_position" INTEGER,
    "scopus_author_id" VARCHAR(64),

    CONSTRAINT "research_contribution_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_contribution_review" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_contribution_id" UUID NOT NULL,
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

    CONSTRAINT "research_contribution_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_contribution_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_contribution_id" UUID NOT NULL,
    "from_status" "research_contribution_status_enum",
    "to_status" "research_contribution_status_enum" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "comments" TEXT,
    "metadata" JSONB,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_contribution_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_contribution_edit_suggestion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "research_contribution_id" UUID NOT NULL,
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

    CONSTRAINT "research_contribution_edit_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "publication_type" VARCHAR(50) NOT NULL,
    "policy_name" VARCHAR(255) NOT NULL,
    "base_incentive_amount" DECIMAL(15,2) NOT NULL,
    "base_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "primary_author_share" DECIMAL(5,2),
    "author_type_multipliers" JSONB DEFAULT '{"co_author": 0.5, "first_author": 1.0, "corresponding_author": 0.8, "first_and_corresponding_author": 1.2}',
    "indexing_bonuses" JSONB DEFAULT '{"ugc": 2500, "wos": 7500, "both": 10000, "scopus": 5000}',
    "impact_factor_tiers" JSONB DEFAULT '[{"max": 1, "min": 0, "bonus": 0}, {"max": 3, "min": 1, "bonus": 5000}, {"max": 5, "min": 3, "bonus": 10000}, {"max": 100, "min": 5, "bonus": 20000}]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corresponding_author_percentage" DECIMAL(5,2) DEFAULT 30,
    "distribution_method" "distribution_method_enum" NOT NULL DEFAULT 'author_role_based',
    "first_author_percentage" DECIMAL(5,2) DEFAULT 40,
    "position_based_distribution" JSONB,

    CONSTRAINT "research_incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "policy_name" VARCHAR(255) NOT NULL,
    "authored_incentive_amount" DECIMAL(15,2) NOT NULL,
    "authored_points" INTEGER NOT NULL,
    "edited_incentive_amount" DECIMAL(15,2) NOT NULL,
    "edited_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "indexing_bonuses" JSONB DEFAULT '{"non_indexed": 0, "scopus_indexed": 10000, "sgt_publication_house": 2000}',
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
    "university_id" UUID NOT NULL,
    "policy_name" VARCHAR(255) NOT NULL,
    "authored_incentive_amount" DECIMAL(15,2) NOT NULL,
    "authored_points" INTEGER NOT NULL,
    "edited_incentive_amount" DECIMAL(15,2) NOT NULL,
    "edited_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "indexing_bonuses" JSONB DEFAULT '{"non_indexed": 0, "scopus_indexed": 10000, "sgt_publication_house": 2000}',
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
    "university_id" UUID NOT NULL,
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
    "university_id" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "reporting_structure" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "department_scope" VARCHAR(32),
    "department_id" UUID,
    "manager_id" UUID,
    "hierarchy_depth" INTEGER NOT NULL DEFAULT 0,
    "hierarchy_path" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "reporting_structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "university_id" UUID,
    "user_role" VARCHAR(32) NOT NULL,
    "user_identifier" VARCHAR(64) NOT NULL,
    "user_email" VARCHAR(255),
    "description" TEXT NOT NULL,
    "page_url" VARCHAR(2048) NOT NULL,
    "route_path" VARCHAR(512) NOT NULL,
    "resolution_status" "ResolutionStatus" NOT NULL DEFAULT 'unresolved',
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_report_screenshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bug_report_id" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "stored_filename" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "storage_path" VARCHAR(512) NOT NULL,
    "thumbnail_filename" VARCHAR(255),
    "thumbnail_path" VARCHAR(512),
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_report_screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "license_key" VARCHAR(128) NOT NULL,
    "assigned_to" VARCHAR(256) NOT NULL,
    "hardware_id" VARCHAR(128),
    "allowed_hardware_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pending_hardware_id" VARCHAR(128),
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "activated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "universities_code_key" ON "universities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "universities_slug_key" ON "universities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tiers_name_key" ON "saas_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "university_subscriptions_university_id_key" ON "university_subscriptions"("university_id");

-- CreateIndex
CREATE INDEX "api_usage_daily_date_idx" ON "api_usage_daily"("date");

-- CreateIndex
CREATE INDEX "api_usage_daily_university_id_date_idx" ON "api_usage_daily"("university_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_daily_university_id_date_key" ON "api_usage_daily"("university_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_login_uid_key" ON "user_login"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "user_login_email_key" ON "user_login"("email");

-- CreateIndex
CREATE INDEX "user_login_university_id_idx" ON "user_login"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "employee_details_user_login_id_key" ON "employee_details"("user_login_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_details_emp_id_key" ON "employee_details"("emp_id");

-- CreateIndex
CREATE INDEX "employee_details_emp_id_idx" ON "employee_details"("emp_id");

-- CreateIndex
CREATE INDEX "employee_details_primary_school_id_idx" ON "employee_details"("primary_school_id");

-- CreateIndex
CREATE INDEX "employee_details_primary_department_id_idx" ON "employee_details"("primary_department_id");

-- CreateIndex
CREATE INDEX "employee_details_display_name_idx" ON "employee_details"("display_name");

-- CreateIndex
CREATE INDEX "employee_details_first_name_idx" ON "employee_details"("first_name");

-- CreateIndex
CREATE INDEX "employee_details_last_name_idx" ON "employee_details"("last_name");

-- CreateIndex
CREATE UNIQUE INDEX "card_rfid_uid_key" ON "card"("rfid_uid");

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
CREATE INDEX "audit_log_university_id_idx" ON "audit_log"("university_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_target_action_idx" ON "audit_log"("target_table", "action", "actor_id", "target_id");

-- CreateIndex
CREATE INDEX "audit_log_target_action_created_at_idx" ON "audit_log"("target_table", "target_id", "action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_department_permission_user_id_department_key" ON "user_department_permission"("user_id", "department");

-- CreateIndex
CREATE INDEX "department_permission_user_id_idx" ON "department_permission"("user_id");

-- CreateIndex
CREATE INDEX "department_permission_department_id_idx" ON "department_permission"("department_id");

-- CreateIndex
CREATE INDEX "department_permission_is_primary_idx" ON "department_permission"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "department_permission_user_id_department_id_key" ON "department_permission"("user_id", "department_id");

-- CreateIndex
CREATE INDEX "central_department_permission_user_id_idx" ON "central_department_permission"("user_id");

-- CreateIndex
CREATE INDEX "central_department_permission_central_dept_id_idx" ON "central_department_permission"("central_dept_id");

-- CreateIndex
CREATE INDEX "central_department_permission_is_primary_idx" ON "central_department_permission"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "central_department_permission_user_id_central_dept_id_key" ON "central_department_permission"("user_id", "central_dept_id");

-- CreateIndex
CREATE INDEX "faculty_school_list_university_id_idx" ON "faculty_school_list"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_school_list_university_id_faculty_code_key" ON "faculty_school_list"("university_id", "faculty_code");

-- CreateIndex
CREATE UNIQUE INDEX "department_department_code_key" ON "department"("department_code");

-- CreateIndex
CREATE INDEX "central_department_university_id_idx" ON "central_department"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "central_department_university_id_department_code_key" ON "central_department"("university_id", "department_code");

-- CreateIndex
CREATE INDEX "role_university_id_idx" ON "role"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_university_id_role_code_key" ON "role"("university_id", "role_code");

-- CreateIndex
CREATE UNIQUE INDEX "role_university_id_name_key" ON "role"("university_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "program_program_code_key" ON "program"("program_code");

-- CreateIndex
CREATE UNIQUE INDEX "program_specialization_specialization_code_key" ON "program_specialization"("specialization_code");

-- CreateIndex
CREATE UNIQUE INDEX "section_program_id_section_code_academic_year_semester_key" ON "section"("program_id", "section_code", "academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_user_login_id_key" ON "student_details"("user_login_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_student_id_key" ON "student_details"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_registration_no_key" ON "student_details"("registration_no");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_email_key" ON "student_details"("email");

-- CreateIndex
CREATE INDEX "student_details_gender_idx" ON "student_details"("gender");

-- CreateIndex
CREATE INDEX "student_details_program_id_idx" ON "student_details"("program_id");

-- CreateIndex
CREATE INDEX "student_details_graduation_date_idx" ON "student_details"("graduation_date");

-- CreateIndex
CREATE INDEX "student_details_section_id_idx" ON "student_details"("section_id");

-- CreateIndex
CREATE INDEX "student_details_display_name_idx" ON "student_details"("display_name");

-- CreateIndex
CREATE INDEX "student_details_first_name_idx" ON "student_details"("first_name");

-- CreateIndex
CREATE INDEX "student_details_last_name_idx" ON "student_details"("last_name");

-- CreateIndex
CREATE UNIQUE INDEX "parent_details_user_login_id_key" ON "parent_details"("user_login_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_application_application_number_key" ON "ipr_application"("application_number");

-- CreateIndex
CREATE INDEX "ipr_application_applicant_user_id_idx" ON "ipr_application"("applicant_user_id");

-- CreateIndex
CREATE INDEX "ipr_application_ipr_type_idx" ON "ipr_application"("ipr_type");

-- CreateIndex
CREATE INDEX "ipr_application_school_id_idx" ON "ipr_application"("school_id");

-- CreateIndex
CREATE INDEX "ipr_application_department_id_idx" ON "ipr_application"("department_id");

-- CreateIndex
CREATE INDEX "ipr_application_status_idx" ON "ipr_application"("status");

-- CreateIndex
CREATE INDEX "ipr_application_submitted_at_idx" ON "ipr_application"("submitted_at");

-- CreateIndex
CREATE INDEX "ipr_application_current_reviewer_id_idx" ON "ipr_application"("current_reviewer_id");

-- CreateIndex
CREATE INDEX "ipr_application_status_current_reviewer_id_idx" ON "ipr_application"("status", "current_reviewer_id");

-- CreateIndex
CREATE INDEX "ipr_application_school_id_submitted_at_idx" ON "ipr_application"("school_id", "submitted_at");

-- CreateIndex
CREATE INDEX "ipr_application_source_provisional_id_idx" ON "ipr_application"("source_provisional_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_applicant_details_ipr_application_id_key" ON "ipr_applicant_details"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_applicant_details_mentor_uid_idx" ON "ipr_applicant_details"("mentor_uid");

-- CreateIndex
CREATE INDEX "ipr_contributor_ipr_application_id_idx" ON "ipr_contributor"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_contributor_user_id_idx" ON "ipr_contributor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_contributor_ipr_application_id_uid_key" ON "ipr_contributor"("ipr_application_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_sdg_ipr_application_id_sdg_code_key" ON "ipr_sdg"("ipr_application_id", "sdg_code");

-- CreateIndex
CREATE INDEX "ipr_review_ipr_application_id_idx" ON "ipr_review"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_review_reviewer_id_idx" ON "ipr_review"("reviewer_id");

-- CreateIndex
CREATE INDEX "ipr_review_decision_idx" ON "ipr_review"("decision");

-- CreateIndex
CREATE INDEX "ipr_review_ipr_application_id_decision_idx" ON "ipr_review"("ipr_application_id", "decision");

-- CreateIndex
CREATE INDEX "ipr_edit_suggestion_ipr_application_id_idx" ON "ipr_edit_suggestion"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_edit_suggestion_reviewer_id_idx" ON "ipr_edit_suggestion"("reviewer_id");

-- CreateIndex
CREATE INDEX "ipr_edit_suggestion_status_idx" ON "ipr_edit_suggestion"("status");

-- CreateIndex
CREATE INDEX "ipr_collaborative_session_ipr_application_id_idx" ON "ipr_collaborative_session"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_collaborative_session_reviewer_id_idx" ON "ipr_collaborative_session"("reviewer_id");

-- CreateIndex
CREATE INDEX "ipr_status_history_ipr_application_id_idx" ON "ipr_status_history"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_finance_ipr_application_id_idx" ON "ipr_finance"("ipr_application_id");

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
CREATE INDEX "incentive_policy_university_id_idx" ON "incentive_policy"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "incentive_policy_university_id_ipr_type_is_active_key" ON "incentive_policy"("university_id", "ipr_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "research_paper_author_user_id_idx" ON "research_paper"("author_user_id");

-- CreateIndex
CREATE INDEX "research_paper_status_idx" ON "research_paper"("status");

-- CreateIndex
CREATE INDEX "research_paper_school_id_idx" ON "research_paper"("school_id");

-- CreateIndex
CREATE INDEX "research_paper_department_id_idx" ON "research_paper"("department_id");

-- CreateIndex
CREATE INDEX "research_paper_review_research_paper_id_idx" ON "research_paper_review"("research_paper_id");

-- CreateIndex
CREATE INDEX "research_paper_review_reviewer_id_idx" ON "research_paper_review"("reviewer_id");

-- CreateIndex
CREATE INDEX "research_paper_status_history_research_paper_id_idx" ON "research_paper_status_history"("research_paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_application_number_key" ON "ipr"("application_number");

-- CreateIndex
CREATE INDEX "ipr_type_idx" ON "ipr"("type");

-- CreateIndex
CREATE INDEX "ipr_status_idx" ON "ipr"("status");

-- CreateIndex
CREATE INDEX "ipr_department_idx" ON "ipr"("department");

-- CreateIndex
CREATE INDEX "ipr_created_by_id_idx" ON "ipr"("created_by_id");

-- CreateIndex
CREATE INDEX "ipr_submission_date_idx" ON "ipr"("submission_date");

-- CreateIndex
CREATE INDEX "ipr_document_ipr_id_idx" ON "ipr_document"("ipr_id");

-- CreateIndex
CREATE INDEX "document_change_ipr_application_id_idx" ON "document_change"("ipr_application_id");

-- CreateIndex
CREATE INDEX "document_change_field_name_idx" ON "document_change"("field_name");

-- CreateIndex
CREATE INDEX "document_change_status_idx" ON "document_change"("status");

-- CreateIndex
CREATE INDEX "document_change_reviewer_id_idx" ON "document_change"("reviewer_id");

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE INDEX "notification_is_read_idx" ON "notification"("is_read");

-- CreateIndex
CREATE INDEX "notification_userId_isRead_idx" ON "notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notification_type_idx" ON "notification"("type");

-- CreateIndex
CREATE INDEX "notification_reference_id_idx" ON "notification"("reference_id");

-- CreateIndex
CREATE INDEX "notification_university_id_idx" ON "notification"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_contribution_application_number_key" ON "research_contribution"("application_number");

-- CreateIndex
CREATE INDEX "research_contribution_applicant_user_id_idx" ON "research_contribution"("applicant_user_id");

-- CreateIndex
CREATE INDEX "research_contribution_status_idx" ON "research_contribution"("status");

-- CreateIndex
CREATE INDEX "research_contribution_publication_type_idx" ON "research_contribution"("publication_type");

-- CreateIndex
CREATE INDEX "research_contribution_school_id_idx" ON "research_contribution"("school_id");

-- CreateIndex
CREATE INDEX "research_contribution_department_id_idx" ON "research_contribution"("department_id");

-- CreateIndex
CREATE INDEX "research_contribution_submitted_at_idx" ON "research_contribution"("submitted_at");

-- CreateIndex
CREATE INDEX "research_contribution_current_reviewer_id_idx" ON "research_contribution"("current_reviewer_id");

-- CreateIndex
CREATE INDEX "research_contribution_status_current_reviewer_id_idx" ON "research_contribution"("status", "current_reviewer_id");

-- CreateIndex
CREATE INDEX "research_contribution_school_id_submitted_at_idx" ON "research_contribution"("school_id", "submitted_at");

-- CreateIndex
CREATE INDEX "research_contribution_department_id_submitted_at_idx" ON "research_contribution"("department_id", "submitted_at");

-- CreateIndex
CREATE INDEX "research_contribution_publication_type_school_id_submitted__idx" ON "research_contribution"("publication_type", "school_id", "submitted_at");

-- CreateIndex
CREATE INDEX "research_contribution_conference_sub_type_idx" ON "research_contribution"("conference_sub_type");

-- CreateIndex
CREATE INDEX "research_contribution_source_type_idx" ON "research_contribution"("source_type");

-- CreateIndex
CREATE INDEX "research_contribution_special_review_required_idx" ON "research_contribution"("special_review_required");

-- CreateIndex
CREATE INDEX "research_contribution_doi_idx" ON "research_contribution"("doi");

-- CreateIndex
CREATE INDEX "research_contribution_applicant_user_id_doi_idx" ON "research_contribution"("applicant_user_id", "doi");

-- CreateIndex
CREATE UNIQUE INDEX "research_profile_identity_user_id_key" ON "research_profile_identity"("user_id");

-- CreateIndex
CREATE INDEX "research_profile_identity_orcid_idx" ON "research_profile_identity"("orcid");

-- CreateIndex
CREATE INDEX "research_profile_identity_scopus_author_id_idx" ON "research_profile_identity"("scopus_author_id");

-- CreateIndex
CREATE INDEX "research_profile_identity_pubmed_id_idx" ON "research_profile_identity"("pubmed_id");

-- CreateIndex
CREATE INDEX "research_profile_identity_auto_sync_enabled_last_synced_at_idx" ON "research_profile_identity"("auto_sync_enabled", "last_synced_at");

-- CreateIndex
CREATE INDEX "publication_import_run_research_profile_id_started_at_idx" ON "publication_import_run"("research_profile_id", "started_at");

-- CreateIndex
CREATE INDEX "publication_import_run_status_started_at_idx" ON "publication_import_run"("status", "started_at");

-- CreateIndex
CREATE INDEX "publication_import_research_profile_id_last_seen_at_idx" ON "publication_import"("research_profile_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "publication_import_doi_idx" ON "publication_import"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "publication_import_source_external_key" ON "publication_import"("source_system", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_contribution_applicant_details_contribution_key" ON "research_contribution_applicant_details"("research_contribution_id");

-- CreateIndex
CREATE INDEX "research_contribution_applicant_details_mentor_uid_idx" ON "research_contribution_applicant_details"("mentor_uid");

-- CreateIndex
CREATE INDEX "research_contribution_author_user_id_idx" ON "research_contribution_author"("user_id");

-- CreateIndex
CREATE INDEX "research_contribution_author_contribution_id_idx" ON "research_contribution_author"("research_contribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_contribution_author_contribution_uid_key" ON "research_contribution_author"("research_contribution_id", "uid");

-- CreateIndex
CREATE INDEX "research_contribution_review_reviewer_id_idx" ON "research_contribution_review"("reviewer_id");

-- CreateIndex
CREATE INDEX "research_contribution_review_contribution_id_idx" ON "research_contribution_review"("research_contribution_id");

-- CreateIndex
CREATE INDEX "research_contribution_review_decision_idx" ON "research_contribution_review"("decision");

-- CreateIndex
CREATE INDEX "research_contribution_review_research_contribution_id_decis_idx" ON "research_contribution_review"("research_contribution_id", "decision");

-- CreateIndex
CREATE INDEX "research_contribution_status_history_contribution_id_idx" ON "research_contribution_status_history"("research_contribution_id");

-- CreateIndex
CREATE INDEX "research_contribution_edit_suggestion_reviewer_id_idx" ON "research_contribution_edit_suggestion"("reviewer_id");

-- CreateIndex
CREATE INDEX "research_contribution_edit_suggestion_contribution_id_idx" ON "research_contribution_edit_suggestion"("research_contribution_id");

-- CreateIndex
CREATE INDEX "research_incentive_policy_publication_type_idx" ON "research_incentive_policy"("publication_type");

-- CreateIndex
CREATE INDEX "research_incentive_policy_is_active_idx" ON "research_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "research_incentive_policy_university_id_idx" ON "research_incentive_policy"("university_id");

-- CreateIndex
CREATE INDEX "book_incentive_policy_is_active_idx" ON "book_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "book_incentive_policy_university_id_idx" ON "book_incentive_policy"("university_id");

-- CreateIndex
CREATE INDEX "book_chapter_incentive_policy_is_active_idx" ON "book_chapter_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "book_chapter_incentive_policy_university_id_idx" ON "book_chapter_incentive_policy"("university_id");

-- CreateIndex
CREATE INDEX "conference_incentive_policy_is_active_idx" ON "conference_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "conference_incentive_policy_conference_sub_type_idx" ON "conference_incentive_policy"("conference_sub_type");

-- CreateIndex
CREATE INDEX "conference_incentive_policy_university_id_idx" ON "conference_incentive_policy"("university_id");

-- CreateIndex
CREATE INDEX "grant_incentive_policy_is_active_idx" ON "grant_incentive_policy"("is_active");

-- CreateIndex
CREATE INDEX "grant_incentive_policy_project_category_idx" ON "grant_incentive_policy"("project_category");

-- CreateIndex
CREATE INDEX "grant_incentive_policy_project_type_idx" ON "grant_incentive_policy"("project_type");

-- CreateIndex
CREATE INDEX "grant_incentive_policy_university_id_idx" ON "grant_incentive_policy"("university_id");

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
CREATE INDEX "grant_application_submitted_at_idx" ON "grant_application"("submitted_at");

-- CreateIndex
CREATE INDEX "grant_application_school_id_submitted_at_idx" ON "grant_application"("school_id", "submitted_at");

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
CREATE INDEX "reporting_structure_user_id_idx" ON "reporting_structure"("user_id");

-- CreateIndex
CREATE INDEX "reporting_structure_department_scope_id_idx" ON "reporting_structure"("department_scope", "department_id");

-- CreateIndex
CREATE INDEX "reporting_structure_user_scope_id_isActive_idx" ON "reporting_structure"("user_id", "department_scope", "department_id", "is_active");

-- CreateIndex
CREATE INDEX "reporting_structure_manager_scope_id_isActive_idx" ON "reporting_structure"("manager_id", "department_scope", "department_id", "is_active");

-- CreateIndex
CREATE INDEX "reporting_structure_manager_id_idx" ON "reporting_structure"("manager_id");

-- CreateIndex
CREATE INDEX "reporting_structure_hierarchy_depth_idx" ON "reporting_structure"("hierarchy_depth");

-- CreateIndex
CREATE INDEX "reporting_structure_managerId_isActive_idx" ON "reporting_structure"("manager_id", "is_active");

-- CreateIndex
CREATE INDEX "reporting_structure_userId_isActive_idx" ON "reporting_structure"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "reporting_structure_is_active_idx" ON "reporting_structure"("is_active");

-- CreateIndex
CREATE INDEX "reporting_structure_is_active_manager_id_idx" ON "reporting_structure"("is_active", "manager_id");

-- CreateIndex
CREATE INDEX "reporting_structure_is_active_hierarchy_depth_idx" ON "reporting_structure"("is_active", "hierarchy_depth");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_structure_user_department_unique" ON "reporting_structure"("user_id", "department_scope", "department_id");

-- CreateIndex
CREATE INDEX "bug_reports_user_id_idx" ON "bug_reports"("user_id");

-- CreateIndex
CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports"("created_at");

-- CreateIndex
CREATE INDEX "bug_reports_resolution_status_idx" ON "bug_reports"("resolution_status");

-- CreateIndex
CREATE INDEX "bug_reports_resolved_by_idx" ON "bug_reports"("resolved_by");

-- CreateIndex
CREATE INDEX "bug_reports_university_id_idx" ON "bug_reports"("university_id");

-- CreateIndex
CREATE INDEX "bug_report_screenshots_bug_report_id_idx" ON "bug_report_screenshots"("bug_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_key" ON "licenses"("license_key");

-- CreateIndex
CREATE INDEX "licenses_license_key_idx" ON "licenses"("license_key");

-- CreateIndex
CREATE INDEX "licenses_is_active_idx" ON "licenses"("is_active");

-- AddForeignKey
ALTER TABLE "university_subscriptions" ADD CONSTRAINT "university_subscriptions_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_subscriptions" ADD CONSTRAINT "university_subscriptions_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "saas_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_login" ADD CONSTRAINT "user_login_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_primary_central_dept_id_fkey" FOREIGN KEY ("primary_central_dept_id") REFERENCES "central_department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_primary_department_id_fkey" FOREIGN KEY ("primary_department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_primary_school_id_fkey" FOREIGN KEY ("primary_school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_user_login_id_fkey" FOREIGN KEY ("user_login_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_old_card_id_fkey" FOREIGN KEY ("old_card_id") REFERENCES "card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changes_history" ADD CONSTRAINT "changes_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_staff_roles" ADD CONSTRAINT "admission_staff_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_staff_details" ADD CONSTRAINT "admission_staff_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_faculty_staff" ADD CONSTRAINT "admission_faculty_staff_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrar_staff_roles" ADD CONSTRAINT "registrar_staff_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrar_staff_details" ADD CONSTRAINT "registrar_staff_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrar_faculty_staff" ADD CONSTRAINT "registrar_faculty_staff_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_teaching_staff_roles" ADD CONSTRAINT "hr_teaching_staff_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_non_teaching_staff_roles" ADD CONSTRAINT "hr_non_teaching_staff_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_teaching_staff_details" ADD CONSTRAINT "hr_teaching_staff_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_non_teaching_staff_details" ADD CONSTRAINT "hr_non_teaching_staff_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_permission" ADD CONSTRAINT "user_department_permission_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_permission" ADD CONSTRAINT "user_department_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_permission" ADD CONSTRAINT "department_permission_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_permission" ADD CONSTRAINT "department_permission_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_permission" ADD CONSTRAINT "department_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department_permission" ADD CONSTRAINT "central_department_permission_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department_permission" ADD CONSTRAINT "central_department_permission_central_dept_id_fkey" FOREIGN KEY ("central_dept_id") REFERENCES "central_department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department_permission" ADD CONSTRAINT "central_department_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_school_list" ADD CONSTRAINT "faculty_school_list_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_school_list" ADD CONSTRAINT "faculty_school_list_head_of_faculty_fkey" FOREIGN KEY ("head_of_faculty") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_school_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_head_of_department_fkey" FOREIGN KEY ("head_of_department") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department" ADD CONSTRAINT "central_department_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department" ADD CONSTRAINT "central_department_head_of_department_fkey" FOREIGN KEY ("head_of_department") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program" ADD CONSTRAINT "program_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program" ADD CONSTRAINT "program_program_coordinator_fkey" FOREIGN KEY ("program_coordinator") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_specialization" ADD CONSTRAINT "program_specialization_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_class_teacher_fkey" FOREIGN KEY ("class_teacher") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_data_approved_by_fkey" FOREIGN KEY ("data_approved_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_user_login_id_fkey" FOREIGN KEY ("user_login_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_details" ADD CONSTRAINT "parent_details_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_details" ADD CONSTRAINT "parent_details_user_login_id_fkey" FOREIGN KEY ("user_login_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_source_provisional_id_fkey" FOREIGN KEY ("source_provisional_id") REFERENCES "ipr_application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_applicant_details" ADD CONSTRAINT "ipr_applicant_details_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_contributor" ADD CONSTRAINT "ipr_contributor_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_contributor" ADD CONSTRAINT "ipr_contributor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_sdg" ADD CONSTRAINT "ipr_sdg_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_review" ADD CONSTRAINT "ipr_review_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_review" ADD CONSTRAINT "ipr_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_edit_suggestion" ADD CONSTRAINT "ipr_edit_suggestion_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_edit_suggestion" ADD CONSTRAINT "ipr_edit_suggestion_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_collaborative_session" ADD CONSTRAINT "ipr_collaborative_session_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_collaborative_session" ADD CONSTRAINT "ipr_collaborative_session_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_history" ADD CONSTRAINT "ipr_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_history" ADD CONSTRAINT "ipr_status_history_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_finance" ADD CONSTRAINT "ipr_finance_finance_reviewer_id_fkey" FOREIGN KEY ("finance_reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_finance" ADD CONSTRAINT "ipr_finance_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper" ADD CONSTRAINT "research_paper_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper" ADD CONSTRAINT "research_paper_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper" ADD CONSTRAINT "research_paper_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_review" ADD CONSTRAINT "research_paper_review_research_paper_id_fkey" FOREIGN KEY ("research_paper_id") REFERENCES "research_paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_review" ADD CONSTRAINT "research_paper_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_status_history" ADD CONSTRAINT "research_paper_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_status_history" ADD CONSTRAINT "research_paper_status_history_research_paper_id_fkey" FOREIGN KEY ("research_paper_id") REFERENCES "research_paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr" ADD CONSTRAINT "ipr_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr" ADD CONSTRAINT "ipr_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_document" ADD CONSTRAINT "ipr_document_ipr_id_fkey" FOREIGN KEY ("ipr_id") REFERENCES "ipr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_document" ADD CONSTRAINT "ipr_document_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_change" ADD CONSTRAINT "document_change_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_change" ADD CONSTRAINT "document_change_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_profile_identity" ADD CONSTRAINT "research_profile_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_import_run" ADD CONSTRAINT "publication_import_run_research_profile_id_fkey" FOREIGN KEY ("research_profile_id") REFERENCES "research_profile_identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_import_run" ADD CONSTRAINT "publication_import_run_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_import" ADD CONSTRAINT "publication_import_research_profile_id_fkey" FOREIGN KEY ("research_profile_id") REFERENCES "research_profile_identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_import" ADD CONSTRAINT "publication_import_research_contribution_id_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_applicant_details" ADD CONSTRAINT "research_contribution_applicant_details_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_author" ADD CONSTRAINT "research_contribution_author_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_author" ADD CONSTRAINT "research_contribution_author_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_review" ADD CONSTRAINT "research_contribution_review_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_review" ADD CONSTRAINT "research_contribution_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_status_history" ADD CONSTRAINT "research_contribution_status_history_changed_by_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_status_history" ADD CONSTRAINT "research_contribution_status_history_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_edit_suggestion" ADD CONSTRAINT "research_contribution_edit_suggestion_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_edit_suggestion" ADD CONSTRAINT "research_contribution_edit_suggestion_reviewer_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_research_contribution_id_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_status_history" ADD CONSTRAINT "research_progress_status_history_tracker_id_fkey" FOREIGN KEY ("tracker_id") REFERENCES "research_progress_tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application" ADD CONSTRAINT "grant_application_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application" ADD CONSTRAINT "grant_application_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application" ADD CONSTRAINT "grant_application_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_consortium_organization" ADD CONSTRAINT "grant_consortium_organization_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_investigator" ADD CONSTRAINT "grant_investigator_consortium_org_id_fkey" FOREIGN KEY ("consortium_org_id") REFERENCES "grant_consortium_organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_investigator" ADD CONSTRAINT "grant_investigator_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_investigator" ADD CONSTRAINT "grant_investigator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_review" ADD CONSTRAINT "grant_application_review_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_review" ADD CONSTRAINT "grant_application_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_status_history" ADD CONSTRAINT "grant_application_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_status_history" ADD CONSTRAINT "grant_application_status_history_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_edit_suggestion" ADD CONSTRAINT "grant_application_edit_suggestion_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_edit_suggestion" ADD CONSTRAINT "grant_application_edit_suggestion_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_structure" ADD CONSTRAINT "reporting_structure_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_structure" ADD CONSTRAINT "reporting_structure_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_report_screenshots" ADD CONSTRAINT "bug_report_screenshots_bug_report_id_fkey" FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

