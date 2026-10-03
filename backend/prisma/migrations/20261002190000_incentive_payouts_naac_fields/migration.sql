-- CreateEnum
CREATE TYPE "incentive_source_type_enum" AS ENUM ('research_contribution', 'grant', 'ipr');

-- CreateEnum
CREATE TYPE "incentive_payout_status_enum" AS ENUM ('pending_verification', 'recommended', 'on_hold', 'approved', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "payout_batch_status_enum" AS ENUM ('draft', 'approved', 'paid', 'cancelled');

-- AlterTable
ALTER TABLE "grant_application" ADD COLUMN     "sanction_date" DATE,
ADD COLUMN     "sanction_order_number" VARCHAR(128),
ADD COLUMN     "sanctioned_amount" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "ipr_application" ADD COLUMN     "granted_at" DATE,
ADD COLUMN     "patent_number" VARCHAR(64);

-- AlterTable
ALTER TABLE "research_contribution" ADD COLUMN     "ugc_care_group" VARCHAR(16),
ADD COLUMN     "ugc_care_listed" BOOLEAN,
ADD COLUMN     "work_key" VARCHAR(320);

-- AlterTable
ALTER TABLE "student_details" ADD COLUMN     "phd_awarded_at" DATE,
ADD COLUMN     "phd_registration_date" DATE,
ADD COLUMN     "thesis_title" VARCHAR(512);

-- CreateTable
CREATE TABLE "incentive_payout" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "source_type" "incentive_source_type_enum" NOT NULL,
    "source_id" UUID NOT NULL,
    "research_contribution_id" UUID,
    "work_type" VARCHAR(32) NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "reference_number" VARCHAR(100),
    "work_key" VARCHAR(320),
    "payee_user_id" UUID NOT NULL,
    "payee_name" VARCHAR(256) NOT NULL,
    "payee_employee_id" VARCHAR(64),
    "payee_role" VARCHAR(64),
    "calculated_amount" DECIMAL(15,2) NOT NULL,
    "approved_amount" DECIMAL(15,2) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "adjustment_reason" TEXT,
    "status" "incentive_payout_status_enum" NOT NULL DEFAULT 'pending_verification',
    "hold_reason" TEXT,
    "financial_year" VARCHAR(9) NOT NULL,
    "source_approved_at" TIMESTAMPTZ(6) NOT NULL,
    "recommended_by_id" UUID,
    "recommended_at" TIMESTAMPTZ(6),
    "batch_id" UUID,
    "tds_amount" DECIMAL(15,2),
    "payment_reference" VARCHAR(64),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incentive_payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_batch" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "batch_number" VARCHAR(32) NOT NULL,
    "title" VARCHAR(256),
    "financial_year" VARCHAR(9) NOT NULL,
    "status" "payout_batch_status_enum" NOT NULL DEFAULT 'draft',
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "approval_comments" TEXT,
    "paid_by_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "payment_date" DATE,
    "payment_reference" VARCHAR(64),
    "cancelled_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_payout_event" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "payout_id" UUID,
    "batch_id" UUID,
    "action" VARCHAR(48) NOT NULL,
    "from_status" VARCHAR(32),
    "to_status" VARCHAR(32),
    "amount" DECIMAL(15,2),
    "comments" TEXT,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incentive_payout_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_fund_receipt" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "grant_application_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "received_date" DATE NOT NULL,
    "financial_year" VARCHAR(9) NOT NULL,
    "reference" VARCHAR(128),
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_fund_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incentive_payout_university_id_idx" ON "incentive_payout"("university_id");

-- CreateIndex
CREATE INDEX "incentive_payout_university_id_status_idx" ON "incentive_payout"("university_id", "status");

-- CreateIndex
CREATE INDEX "incentive_payout_university_id_financial_year_idx" ON "incentive_payout"("university_id", "financial_year");

-- CreateIndex
CREATE INDEX "incentive_payout_payee_user_id_idx" ON "incentive_payout"("payee_user_id");

-- CreateIndex
CREATE INDEX "incentive_payout_batch_id_idx" ON "incentive_payout"("batch_id");

-- CreateIndex
CREATE INDEX "incentive_payout_research_contribution_id_idx" ON "incentive_payout"("research_contribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "incentive_payout_university_id_source_type_source_id_payee__key" ON "incentive_payout"("university_id", "source_type", "source_id", "payee_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "incentive_payout_university_id_work_key_payee_user_id_key" ON "incentive_payout"("university_id", "work_key", "payee_user_id");

-- CreateIndex
CREATE INDEX "payout_batch_university_id_idx" ON "payout_batch"("university_id");

-- CreateIndex
CREATE INDEX "payout_batch_university_id_status_idx" ON "payout_batch"("university_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payout_batch_university_id_batch_number_key" ON "payout_batch"("university_id", "batch_number");

-- CreateIndex
CREATE INDEX "incentive_payout_event_university_id_idx" ON "incentive_payout_event"("university_id");

-- CreateIndex
CREATE INDEX "incentive_payout_event_payout_id_idx" ON "incentive_payout_event"("payout_id");

-- CreateIndex
CREATE INDEX "incentive_payout_event_batch_id_idx" ON "incentive_payout_event"("batch_id");

-- CreateIndex
CREATE INDEX "grant_fund_receipt_university_id_idx" ON "grant_fund_receipt"("university_id");

-- CreateIndex
CREATE INDEX "grant_fund_receipt_grant_application_id_idx" ON "grant_fund_receipt"("grant_application_id");

-- CreateIndex
CREATE INDEX "grant_fund_receipt_university_id_financial_year_idx" ON "grant_fund_receipt"("university_id", "financial_year");

-- CreateIndex
CREATE INDEX "research_contribution_university_id_work_key_idx" ON "research_contribution"("university_id", "work_key");

-- AddForeignKey
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_research_contribution_id_fkey" FOREIGN KEY ("research_contribution_id") REFERENCES "research_contribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_payee_user_id_fkey" FOREIGN KEY ("payee_user_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_recommended_by_id_fkey" FOREIGN KEY ("recommended_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payout_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch" ADD CONSTRAINT "payout_batch_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch" ADD CONSTRAINT "payout_batch_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch" ADD CONSTRAINT "payout_batch_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batch" ADD CONSTRAINT "payout_batch_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout_event" ADD CONSTRAINT "incentive_payout_event_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout_event" ADD CONSTRAINT "incentive_payout_event_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "incentive_payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout_event" ADD CONSTRAINT "incentive_payout_event_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payout_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout_event" ADD CONSTRAINT "incentive_payout_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_fund_receipt" ADD CONSTRAINT "grant_fund_receipt_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_fund_receipt" ADD CONSTRAINT "grant_fund_receipt_grant_application_id_fkey" FOREIGN KEY ("grant_application_id") REFERENCES "grant_application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_fund_receipt" ADD CONSTRAINT "grant_fund_receipt_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security for the new tenant tables (same policy as 20261002170000_tenant_row_level_security).
ALTER TABLE "incentive_payout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incentive_payout" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "incentive_payout" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));
ALTER TABLE "payout_batch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payout_batch" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payout_batch" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));
ALTER TABLE "incentive_payout_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incentive_payout_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "incentive_payout_event" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));
ALTER TABLE "grant_fund_receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_fund_receipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_fund_receipt" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- Money and points are never negative.
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_amounts_check"
  CHECK ("calculated_amount" >= 0 AND "approved_amount" >= 0 AND "points" >= 0 AND coalesce("tds_amount", 0) >= 0);
ALTER TABLE "grant_fund_receipt" ADD CONSTRAINT "grant_fund_receipt_amount_check" CHECK ("amount" > 0);
