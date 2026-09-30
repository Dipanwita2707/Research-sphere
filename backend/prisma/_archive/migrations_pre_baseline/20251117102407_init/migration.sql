-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
CREATE TYPE "section_status_enum" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "department_enum" AS ENUM ('ADMISSION', 'REGISTRAR', 'HR_TEACHING', 'HR_NON_TEACHING');

-- CreateTable
CREATE TABLE "user_login" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "uid" VARCHAR(32) NOT NULL,
    "email" CITEXT,
    "phone" VARCHAR(20),
    "profile_image_s3_key" TEXT,
    "profile_image" VARCHAR(64),
    "password_hash" TEXT NOT NULL,
    "role" "user_role_enum" NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_login_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_details" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_login_id" UUID,
    "first_name" VARCHAR(128) NOT NULL,
    "last_name" VARCHAR(128),
    "display_name" VARCHAR(256),
    "photo_s3_key" TEXT,
    "photo" VARCHAR(64),
    "emp_id" VARCHAR(64),
    "department_id" UUID,
    "designation" VARCHAR(128),
    "join_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "latest_image_s3_key" TEXT,
    "photo_s3_key" TEXT,
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
    "proof_s3_key" TEXT,
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
    "action" VARCHAR(256) NOT NULL,
    "target_table" VARCHAR(128),
    "target_id" UUID,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "faculty_school_list" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
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
CREATE TABLE "program" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "department_id" UUID NOT NULL,
    "program_code" VARCHAR(32) NOT NULL,
    "program_name" VARCHAR(256) NOT NULL,
    "program_type" "program_type_enum" NOT NULL,
    "short_name" VARCHAR(64),
    "description" TEXT,
    "duration_years" INTEGER NOT NULL DEFAULT 4,
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
    "photo_s3_key" TEXT,
    "photo" VARCHAR(64),
    "section_id" UUID NOT NULL,
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
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- CreateIndex
CREATE UNIQUE INDEX "user_login_uid_key" ON "user_login"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "user_login_email_key" ON "user_login"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employee_details_user_login_id_key" ON "employee_details"("user_login_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_details_emp_id_key" ON "employee_details"("emp_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_rfid_uid_key" ON "card"("rfid_uid");

-- CreateIndex
CREATE UNIQUE INDEX "user_department_permission_user_id_department_key" ON "user_department_permission"("user_id", "department");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_school_list_faculty_code_key" ON "faculty_school_list"("faculty_code");

-- CreateIndex
CREATE UNIQUE INDEX "department_department_code_key" ON "department"("department_code");

-- CreateIndex
CREATE UNIQUE INDEX "program_program_code_key" ON "program"("program_code");

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
CREATE UNIQUE INDEX "parent_details_user_login_id_key" ON "parent_details"("user_login_id");

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_user_login_id_fkey" FOREIGN KEY ("user_login_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card" ADD CONSTRAINT "card_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_old_card_id_fkey" FOREIGN KEY ("old_card_id") REFERENCES "card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reissue_request" ADD CONSTRAINT "reissue_request_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "user_department_permission" ADD CONSTRAINT "user_department_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_department_permission" ADD CONSTRAINT "user_department_permission_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_school_list" ADD CONSTRAINT "faculty_school_list_head_of_faculty_fkey" FOREIGN KEY ("head_of_faculty") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty_school_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_head_of_department_fkey" FOREIGN KEY ("head_of_department") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program" ADD CONSTRAINT "program_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program" ADD CONSTRAINT "program_program_coordinator_fkey" FOREIGN KEY ("program_coordinator") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section" ADD CONSTRAINT "section_class_teacher_fkey" FOREIGN KEY ("class_teacher") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_user_login_id_fkey" FOREIGN KEY ("user_login_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_data_approved_by_fkey" FOREIGN KEY ("data_approved_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_details" ADD CONSTRAINT "parent_details_user_login_id_fkey" FOREIGN KEY ("user_login_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_details" ADD CONSTRAINT "parent_details_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;
