-- CreateEnum: Research Publication Type
CREATE TYPE "research_publication_type_enum" AS ENUM (
  'research_paper',
  'book',
  'book_chapter',
  'conference_paper',
  'grant_proposal'
);

-- CreateEnum: Research Contribution Status
CREATE TYPE "research_contribution_status_enum" AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'changes_required',
  'resubmitted',
  'approved',
  'rejected',
  'completed',
  'cancelled'
);

-- CreateEnum: Research Author Type
CREATE TYPE "research_author_type_enum" AS ENUM (
  'first_author',
  'corresponding_author',
  'co_author',
  'first_and_corresponding_author'
);

-- CreateEnum: Targeted Research Type
CREATE TYPE "targeted_research_type_enum" AS ENUM (
  'scopus',
  'wos',
  'both',
  'ugc'
);

-- Add assignedResearchSchoolIds to CentralDepartmentPermission for separate research school assignments
ALTER TABLE "central_department_permission" 
ADD COLUMN IF NOT EXISTS "assigned_research_school_ids" JSONB DEFAULT '[]';

-- CreateTable: research_contribution (Main entity)
CREATE TABLE "research_contribution" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "application_number" VARCHAR(32),
  "applicant_user_id" UUID,
  "applicant_type" "applicant_type_enum" NOT NULL,
  
  -- Publication Type & Category
  "publication_type" "research_publication_type_enum" NOT NULL,
  
  -- Common Fields
  "title" VARCHAR(512) NOT NULL,
  "abstract" TEXT,
  "keywords" VARCHAR(512),
  
  -- School/Department Mapping
  "school_id" UUID,
  "department_id" UUID,
  
  -- Status & Workflow
  "status" "research_contribution_status_enum" NOT NULL DEFAULT 'draft',
  "current_reviewer_id" UUID,
  "revision_count" INTEGER NOT NULL DEFAULT 0,
  
  -- Research Paper Specific Fields
  "targeted_research_type" "targeted_research_type_enum",
  "international_author" BOOLEAN DEFAULT false,
  "foreign_collaborations_count" INTEGER DEFAULT 0,
  "impact_factor" DECIMAL(10, 4),
  "sjr" DECIMAL(10, 4),
  "interdisciplinary_from_sgt" BOOLEAN DEFAULT false,
  "students_from_sgt" BOOLEAN DEFAULT false,
  "journal_name" VARCHAR(512),
  "total_authors" INTEGER DEFAULT 1,
  "sgt_affiliated_authors" INTEGER DEFAULT 1,
  "internal_co_authors" INTEGER DEFAULT 0,
  "volume" VARCHAR(64),
  "issue" VARCHAR(64),
  "page_numbers" VARCHAR(64),
  "doi" VARCHAR(256),
  "issn" VARCHAR(32),
  "publisher_name" VARCHAR(256),
  
  -- Book/Chapter Specific Fields
  "isbn" VARCHAR(32),
  "edition" VARCHAR(64),
  "chapter_number" VARCHAR(32),
  "book_title" VARCHAR(512),
  "editors" VARCHAR(512),
  "publisher_location" VARCHAR(256),
  
  -- Conference Specific Fields
  "conference_name" VARCHAR(512),
  "conference_location" VARCHAR(256),
  "conference_date" DATE,
  "proceedings_title" VARCHAR(512),
  
  -- Grant Proposal Specific Fields
  "funding_agency" VARCHAR(256),
  "proposal_type" VARCHAR(64),
  "requested_amount" DECIMAL(15, 2),
  "sanctioned_amount" DECIMAL(15, 2),
  "project_duration_months" INTEGER,
  "project_start_date" DATE,
  "project_end_date" DATE,
  
  -- Publication Details
  "publication_date" DATE,
  "publication_status" VARCHAR(64),
  
  -- File Attachments
  "manuscript_file_path" VARCHAR(512),
  "supporting_docs_file_paths" JSONB,
  
  -- Indexing Information (JSON for flexibility)
  "indexing_details" JSONB DEFAULT '{}',
  
  -- Incentive & Points (Pre-calculated at submission, credited at approval)
  "calculated_incentive_amount" DECIMAL(15, 2),
  "calculated_points" INTEGER,
  "incentive_amount" DECIMAL(15, 2),
  "points_awarded" INTEGER,
  "credited_at" TIMESTAMPTZ(6),
  
  -- Timestamps
  "submitted_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "research_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_contribution_applicant_details
CREATE TABLE "research_contribution_applicant_details" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "research_contribution_id" UUID NOT NULL,
  
  -- Internal Applicant
  "employee_category" VARCHAR(64),
  "employee_type" VARCHAR(64),
  "uid" VARCHAR(64),
  "email" VARCHAR(256),
  "phone" VARCHAR(20),
  "university_dept_name" VARCHAR(256),
  
  -- Student-specific fields
  "mentor_name" VARCHAR(256),
  "mentor_uid" VARCHAR(64),
  
  -- Ph.D. Work Linkage
  "is_phd_work" BOOLEAN DEFAULT false,
  "phd_title" VARCHAR(512),
  "phd_objectives" TEXT,
  "covered_objectives" VARCHAR(256),
  
  -- Publication Addresses (What issues does this publication address)
  "addresses_societal" BOOLEAN DEFAULT false,
  "addresses_government" BOOLEAN DEFAULT false,
  "addresses_environmental" BOOLEAN DEFAULT false,
  "addresses_industrial" BOOLEAN DEFAULT false,
  "addresses_business" BOOLEAN DEFAULT false,
  "addresses_conceptual" BOOLEAN DEFAULT false,
  "enriches_discipline" BOOLEAN DEFAULT false,
  
  -- Additional flags
  "is_newsworthy" BOOLEAN DEFAULT false,
  
  -- Metadata
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "research_contribution_applicant_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_contribution_author (Co-authors)
CREATE TABLE "research_contribution_author" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "research_contribution_id" UUID NOT NULL,
  "user_id" UUID,
  
  -- Author Details
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
  
  -- Author Category
  "is_internal" BOOLEAN NOT NULL DEFAULT true,
  "author_category" VARCHAR(64), -- student, faculty
  
  -- Ph.D. Linkage (for student authors)
  "is_phd_work" BOOLEAN DEFAULT false,
  "phd_title" VARCHAR(512),
  "phd_objectives" TEXT,
  "covered_objectives" VARCHAR(256),
  
  -- Publication Addresses
  "addresses_societal" BOOLEAN DEFAULT false,
  "addresses_government" BOOLEAN DEFAULT false,
  "addresses_environmental" BOOLEAN DEFAULT false,
  "addresses_industrial" BOOLEAN DEFAULT false,
  "addresses_business" BOOLEAN DEFAULT false,
  "addresses_conceptual" BOOLEAN DEFAULT false,
  "is_newsworthy" BOOLEAN DEFAULT false,
  
  -- Incentive share (calculated based on author type)
  "incentive_share" DECIMAL(15, 2),
  "points_share" INTEGER,
  
  -- Access Control
  "can_view" BOOLEAN NOT NULL DEFAULT true,
  "can_edit" BOOLEAN NOT NULL DEFAULT false,
  
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "research_contribution_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_contribution_review
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
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "research_contribution_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_contribution_status_history
CREATE TABLE "research_contribution_status_history" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "research_contribution_id" UUID NOT NULL,
  "from_status" "research_contribution_status_enum",
  "to_status" "research_contribution_status_enum" NOT NULL,
  "changed_by_id" UUID NOT NULL,
  "comments" TEXT,
  "metadata" JSONB,
  "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "research_contribution_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_contribution_edit_suggestion
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
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "research_contribution_edit_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: research_incentive_policy
CREATE TABLE "research_incentive_policy" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  
  "publication_type" VARCHAR(50) NOT NULL,
  "policy_name" VARCHAR(255) NOT NULL,
  
  -- Base incentives
  "base_incentive_amount" DECIMAL(15, 2) NOT NULL,
  "base_points" INTEGER NOT NULL,
  
  -- Split policy
  "split_policy" VARCHAR(50) NOT NULL,
  "primary_author_share" DECIMAL(5, 2),
  
  -- Author type multipliers (JSON)
  "author_type_multipliers" JSONB DEFAULT '{"first_author": 1.0, "corresponding_author": 0.8, "co_author": 0.5, "first_and_corresponding_author": 1.2}',
  
  -- Indexing bonuses
  "indexing_bonuses" JSONB DEFAULT '{"scopus": 5000, "wos": 7500, "both": 10000, "ugc": 2500}',
  
  -- Impact factor tiers
  "impact_factor_tiers" JSONB DEFAULT '[{"min": 0, "max": 1, "bonus": 0}, {"min": 1, "max": 3, "bonus": 5000}, {"min": 3, "max": 5, "bonus": 10000}, {"min": 5, "max": 100, "bonus": 20000}]',
  
  -- Policy status
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "effective_to" TIMESTAMPTZ(6),
  
  -- Audit
  "created_by_id" UUID NOT NULL,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "research_incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "research_contribution_application_number_key" ON "research_contribution"("application_number");
CREATE INDEX "research_contribution_applicant_user_id_idx" ON "research_contribution"("applicant_user_id");
CREATE INDEX "research_contribution_status_idx" ON "research_contribution"("status");
CREATE INDEX "research_contribution_publication_type_idx" ON "research_contribution"("publication_type");
CREATE INDEX "research_contribution_school_id_idx" ON "research_contribution"("school_id");
CREATE INDEX "research_contribution_department_id_idx" ON "research_contribution"("department_id");

CREATE UNIQUE INDEX "research_contribution_applicant_details_contribution_key" ON "research_contribution_applicant_details"("research_contribution_id");

CREATE UNIQUE INDEX "research_contribution_author_contribution_uid_key" ON "research_contribution_author"("research_contribution_id", "uid");
CREATE INDEX "research_contribution_author_contribution_id_idx" ON "research_contribution_author"("research_contribution_id");
CREATE INDEX "research_contribution_author_user_id_idx" ON "research_contribution_author"("user_id");

CREATE INDEX "research_contribution_review_contribution_id_idx" ON "research_contribution_review"("research_contribution_id");
CREATE INDEX "research_contribution_review_reviewer_id_idx" ON "research_contribution_review"("reviewer_id");

CREATE INDEX "research_contribution_status_history_contribution_id_idx" ON "research_contribution_status_history"("research_contribution_id");

CREATE INDEX "research_contribution_edit_suggestion_contribution_id_idx" ON "research_contribution_edit_suggestion"("research_contribution_id");
CREATE INDEX "research_contribution_edit_suggestion_reviewer_id_idx" ON "research_contribution_edit_suggestion"("reviewer_id");

CREATE UNIQUE INDEX "unique_active_research_policy_per_type" ON "research_incentive_policy"("publication_type", "is_active") WHERE "is_active" = true;
CREATE INDEX "research_incentive_policy_publication_type_idx" ON "research_incentive_policy"("publication_type");
CREATE INDEX "research_incentive_policy_is_active_idx" ON "research_incentive_policy"("is_active");

-- AddForeignKeys
ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "research_contribution" ADD CONSTRAINT "research_contribution_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "research_contribution_applicant_details" ADD CONSTRAINT "research_contribution_applicant_details_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "research_contribution_author" ADD CONSTRAINT "research_contribution_author_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_contribution_author" ADD CONSTRAINT "research_contribution_author_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "research_contribution_review" ADD CONSTRAINT "research_contribution_review_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_contribution_review" ADD CONSTRAINT "research_contribution_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "research_contribution_status_history" ADD CONSTRAINT "research_contribution_status_history_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_contribution_status_history" ADD CONSTRAINT "research_contribution_status_history_changed_by_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "research_contribution_edit_suggestion" ADD CONSTRAINT "research_contribution_edit_suggestion_contribution_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_contribution_edit_suggestion" ADD CONSTRAINT "research_contribution_edit_suggestion_reviewer_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
