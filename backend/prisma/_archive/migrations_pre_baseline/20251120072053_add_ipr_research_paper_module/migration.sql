-- CreateEnum
CREATE TYPE "ipr_type_enum" AS ENUM ('patent', 'copyright', 'trademark');

-- CreateEnum
CREATE TYPE "ipr_filing_type_enum" AS ENUM ('provisional', 'complete');

-- CreateEnum
CREATE TYPE "ipr_status_enum" AS ENUM ('draft', 'submitted', 'under_drd_review', 'changes_required', 'resubmitted', 'drd_approved', 'drd_rejected', 'under_dean_review', 'dean_approved', 'dean_rejected', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "applicant_type_enum" AS ENUM ('internal_faculty', 'internal_student', 'internal_staff', 'external_academic', 'external_industry', 'external_other');

-- CreateEnum
CREATE TYPE "project_type_enum" AS ENUM ('phd', 'pg_project', 'ug_project', 'faculty_research', 'industry_collaboration', 'any_other');

-- CreateEnum
CREATE TYPE "research_paper_status_enum" AS ENUM ('draft', 'submitted', 'under_review', 'changes_required', 'resubmitted', 'approved', 'rejected', 'published');

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
    "status" "ipr_status_enum" NOT NULL DEFAULT 'draft',
    "current_reviewer_id" UUID,
    "annexure_s3_key" TEXT,
    "supporting_docs_s3_keys" JSONB,
    "incentive_amount" DECIMAL(15,2),
    "points_awarded" INTEGER,
    "credited_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

    CONSTRAINT "ipr_applicant_details_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "ipr_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_status_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "from_status" "ipr_status_enum",
    "to_status" "ipr_status_enum" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "comments" TEXT,
    "metadata" JSONB,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "manuscript_s3_key" TEXT,
    "supporting_docs_s3_keys" JSONB,
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

-- CreateIndex
CREATE INDEX "ipr_application_applicant_user_id_idx" ON "ipr_application"("applicant_user_id");

-- CreateIndex
CREATE INDEX "ipr_application_status_idx" ON "ipr_application"("status");

-- CreateIndex
CREATE INDEX "ipr_application_ipr_type_idx" ON "ipr_application"("ipr_type");

-- CreateIndex
CREATE INDEX "ipr_application_school_id_idx" ON "ipr_application"("school_id");

-- CreateIndex
CREATE INDEX "ipr_application_department_id_idx" ON "ipr_application"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_applicant_details_ipr_application_id_key" ON "ipr_applicant_details"("ipr_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_sdg_ipr_application_id_sdg_code_key" ON "ipr_sdg"("ipr_application_id", "sdg_code");

-- CreateIndex
CREATE INDEX "ipr_review_ipr_application_id_idx" ON "ipr_review"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_review_reviewer_id_idx" ON "ipr_review"("reviewer_id");

-- CreateIndex
CREATE INDEX "ipr_status_history_ipr_application_id_idx" ON "ipr_status_history"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_finance_ipr_application_id_idx" ON "ipr_finance"("ipr_application_id");

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

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_application" ADD CONSTRAINT "ipr_application_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_applicant_details" ADD CONSTRAINT "ipr_applicant_details_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_sdg" ADD CONSTRAINT "ipr_sdg_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_review" ADD CONSTRAINT "ipr_review_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_review" ADD CONSTRAINT "ipr_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_history" ADD CONSTRAINT "ipr_status_history_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_history" ADD CONSTRAINT "ipr_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_finance" ADD CONSTRAINT "ipr_finance_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_finance" ADD CONSTRAINT "ipr_finance_finance_reviewer_id_fkey" FOREIGN KEY ("finance_reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper" ADD CONSTRAINT "research_paper_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper" ADD CONSTRAINT "research_paper_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper" ADD CONSTRAINT "research_paper_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_review" ADD CONSTRAINT "research_paper_review_research_paper_id_fkey" FOREIGN KEY ("research_paper_id") REFERENCES "research_paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_review" ADD CONSTRAINT "research_paper_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_status_history" ADD CONSTRAINT "research_paper_status_history_research_paper_id_fkey" FOREIGN KEY ("research_paper_id") REFERENCES "research_paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_paper_status_history" ADD CONSTRAINT "research_paper_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
