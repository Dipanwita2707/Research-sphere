-- Research budget allocation (school- and department-wise), attributed to the payout ledger.
--
--   research_budget          one per university per Indian FY (total, notes, enforce_limit, warn %)
--   budget_allocation        school / department rows (unique per university, FY, node type, node)
--   budget_allocation_event  append-only audit trail: old -> new, reason, over-budget warnings/blocks
--   incentive_payout         + school_id / department_id: the payee's school and department,
--                            snapshotted when a line is created; backfilled below.
--
-- department.budget_allocation was a single FY-less number that nothing read (only passed through
-- on department create/update). It is replaced by FY-scoped budget_allocation rows. Any value it
-- still holds is preserved in department.metadata.legacyBudgetAllocation before the column is dropped.

UPDATE "department"
SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('legacyBudgetAllocation', "budget_allocation")
WHERE "budget_allocation" IS NOT NULL;

-- CreateEnum
CREATE TYPE "budget_node_type_enum" AS ENUM ('university', 'school', 'department');

-- AlterTable
ALTER TABLE "department" DROP COLUMN "budget_allocation";

-- AlterTable
ALTER TABLE "incentive_payout" ADD COLUMN     "department_id" UUID,
ADD COLUMN     "school_id" UUID;

-- CreateTable
CREATE TABLE "research_budget" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "financial_year" VARCHAR(9) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "category_allocations" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "enforce_limit" BOOLEAN NOT NULL DEFAULT false,
    "warn_threshold_pct" INTEGER NOT NULL DEFAULT 80,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_allocation" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "financial_year" VARCHAR(9) NOT NULL,
    "node_type" "budget_node_type_enum" NOT NULL,
    "node_id" UUID NOT NULL,
    "school_id" UUID,
    "department_id" UUID,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "category_allocations" JSONB NOT NULL DEFAULT '{}',
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_allocation_event" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "financial_year" VARCHAR(9) NOT NULL,
    "node_type" "budget_node_type_enum" NOT NULL,
    "node_id" UUID NOT NULL,
    "node_name" VARCHAR(256),
    "action" VARCHAR(48) NOT NULL,
    "old_amount" DECIMAL(15,2),
    "new_amount" DECIMAL(15,2),
    "old_categories" JSONB,
    "new_categories" JSONB,
    "details" JSONB,
    "reason" TEXT,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_allocation_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_budget_university_id_idx" ON "research_budget"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_budget_university_id_financial_year_key" ON "research_budget"("university_id", "financial_year");

-- CreateIndex
CREATE INDEX "budget_allocation_university_id_idx" ON "budget_allocation"("university_id");

-- CreateIndex
CREATE INDEX "budget_allocation_budget_id_idx" ON "budget_allocation"("budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_allocation_university_id_financial_year_node_type_no_key" ON "budget_allocation"("university_id", "financial_year", "node_type", "node_id");

-- CreateIndex
CREATE INDEX "budget_allocation_event_university_id_financial_year_idx" ON "budget_allocation_event"("university_id", "financial_year");

-- CreateIndex
CREATE INDEX "budget_allocation_event_budget_id_idx" ON "budget_allocation_event"("budget_id");

-- CreateIndex
CREATE INDEX "budget_allocation_event_university_id_node_type_node_id_idx" ON "budget_allocation_event"("university_id", "node_type", "node_id");

-- CreateIndex
CREATE INDEX "incentive_payout_university_id_financial_year_school_id_idx" ON "incentive_payout"("university_id", "financial_year", "school_id");

-- CreateIndex
CREATE INDEX "incentive_payout_department_id_idx" ON "incentive_payout"("department_id");

-- AddForeignKey
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_budget" ADD CONSTRAINT "research_budget_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_budget" ADD CONSTRAINT "research_budget_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_budget" ADD CONSTRAINT "research_budget_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "research_budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "faculty_school_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation_event" ADD CONSTRAINT "budget_allocation_event_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation_event" ADD CONSTRAINT "budget_allocation_event_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "research_budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocation_event" ADD CONSTRAINT "budget_allocation_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity rules Prisma cannot model (the service validates the same rules with clear messages).
ALTER TABLE "research_budget" ADD CONSTRAINT "research_budget_total_nonneg" CHECK ("total_amount" >= 0);
ALTER TABLE "research_budget" ADD CONSTRAINT "research_budget_warn_pct_range" CHECK ("warn_threshold_pct" BETWEEN 1 AND 100);
ALTER TABLE "research_budget" ADD CONSTRAINT "research_budget_fy_format" CHECK ("financial_year" ~ '^[0-9]{4}-[0-9]{2}$');
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_amount_nonneg" CHECK ("amount" >= 0);
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_node_fk_match" CHECK (
  ("node_type" = 'school' AND "school_id" = "node_id" AND "department_id" IS NULL)
  OR ("node_type" = 'department' AND "department_id" = "node_id" AND "school_id" IS NULL)
);

-- Backfill: attribute existing payout lines to the payee's school/department (same university only).
-- Employees: primary department (its school wins, so the department always sits under its school),
-- otherwise primary school.
UPDATE "incentive_payout" ip
SET "school_id" = COALESCE(d."faculty_id", fs."id"),
    "department_id" = d."id"
FROM "employee_details" e
LEFT JOIN "department" d ON d."id" = e."primary_department_id"
LEFT JOIN "faculty_school_list" fs ON fs."id" = e."primary_school_id"
WHERE e."user_login_id" = ip."payee_user_id"
  AND e."university_id" = ip."university_id"
  AND (d."id" IS NULL OR d."university_id" = ip."university_id")
  AND (fs."id" IS NULL OR fs."university_id" = ip."university_id")
  AND COALESCE(d."faculty_id", fs."id") IS NOT NULL
  AND ip."school_id" IS NULL AND ip."department_id" IS NULL;

-- Students: the department that runs their programme.
UPDATE "incentive_payout" ip
SET "school_id" = d."faculty_id",
    "department_id" = d."id"
FROM "student_details" s
JOIN "program" p ON p."id" = s."program_id"
JOIN "department" d ON d."id" = p."department_id"
WHERE s."user_login_id" = ip."payee_user_id"
  AND s."university_id" = ip."university_id"
  AND d."university_id" = ip."university_id"
  AND ip."school_id" IS NULL AND ip."department_id" IS NULL;

