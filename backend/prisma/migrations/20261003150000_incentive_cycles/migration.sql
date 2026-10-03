-- Incentive cycles: the period that incentive policies and the research budget share.
--
--   incentive_cycle            name + start/end date per university; cycles never overlap.
--   research_budget            one per cycle (was one per financial year).
--   budget_allocation / event  keyed by cycle instead of financial_year.
--   incentive_payout.cycle_id  the cycle whose budget a line consumes: the cycle containing the
--                              date that selected its incentive policy (publication date for
--                              research works, sanction/submission date for grants, publication
--                              for IPR). financial_year stays for payment batches and reports.
--
-- Backfill: an April–March cycle ("FY 2026-27") is created for every financial year that has a
-- budget, or a payout line whose policy date falls in it, or that is the current year. Budgets
-- and allocations move to the cycle of their financial year.

BEGIN;

-- CreateTable
CREATE TABLE "incentive_cycle" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "notes" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incentive_cycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incentive_cycle_university_id_name_key" ON "incentive_cycle"("university_id", "name");
CREATE INDEX "incentive_cycle_university_id_start_date_idx" ON "incentive_cycle"("university_id", "start_date");

ALTER TABLE "incentive_cycle" ADD CONSTRAINT "incentive_cycle_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incentive_cycle" ADD CONSTRAINT "incentive_cycle_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incentive_cycle" ADD CONSTRAINT "incentive_cycle_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity rules Prisma cannot model (the service checks the same with clear messages).
CREATE EXTENSION IF NOT EXISTS "btree_gist";
ALTER TABLE "incentive_cycle" ADD CONSTRAINT "incentive_cycle_dates_ordered" CHECK ("end_date" >= "start_date");
ALTER TABLE "incentive_cycle" ADD CONSTRAINT "incentive_cycle_no_overlap"
  EXCLUDE USING gist ("university_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&);

-- ── Backfill cycles ─────────────────────────────────────────────────────────

-- Date that selected each payout line's policy (UTC calendar day, as policy windows compare).
CREATE TEMP TABLE "_payout_policy_day" AS
SELECT ip."id", ip."university_id",
       CASE ip."source_type"
         WHEN 'research_contribution' THEN COALESCE(rc."publication_date", (ip."source_approved_at" AT TIME ZONE 'UTC')::date)
         WHEN 'grant' THEN COALESCE(g."sanction_date", g."date_of_submission", (g."submitted_at" AT TIME ZONE 'UTC')::date, (ip."source_approved_at" AT TIME ZONE 'UTC')::date)
         ELSE (ip."source_approved_at" AT TIME ZONE 'UTC')::date
       END AS "day"
FROM "incentive_payout" ip
LEFT JOIN "research_contribution" rc ON ip."source_type" = 'research_contribution' AND rc."id" = ip."source_id"
LEFT JOIN "grant_application" g ON ip."source_type" = 'grant' AND g."id" = ip."source_id";

-- April–March start year of a day.
CREATE TEMP TABLE "_cycle_years" AS
SELECT DISTINCT "university_id", "start_year" FROM (
  SELECT "university_id", CAST(substring("financial_year" FROM 1 FOR 4) AS int) AS "start_year" FROM "research_budget"
  UNION
  SELECT "university_id", CAST(EXTRACT(YEAR FROM "day") AS int) - CASE WHEN EXTRACT(MONTH FROM "day") < 4 THEN 1 ELSE 0 END FROM "_payout_policy_day" WHERE "day" IS NOT NULL
  UNION
  SELECT u."id", CAST(EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Kolkata')) AS int) - CASE WHEN EXTRACT(MONTH FROM (now() AT TIME ZONE 'Asia/Kolkata')) < 4 THEN 1 ELSE 0 END FROM "universities" u
) y;

INSERT INTO "incentive_cycle" ("university_id", "name", "start_date", "end_date", "created_by_id")
SELECT y."university_id",
       'FY ' || y."start_year" || '-' || lpad(((y."start_year" + 1) % 100)::text, 2, '0'),
       make_date(y."start_year", 4, 1),
       make_date(y."start_year" + 1, 3, 31),
       rb."created_by_id"
FROM "_cycle_years" y
LEFT JOIN "research_budget" rb
  ON rb."university_id" = y."university_id"
 AND rb."financial_year" = y."start_year" || '-' || lpad(((y."start_year" + 1) % 100)::text, 2, '0');

-- ── Payout lines → cycle ────────────────────────────────────────────────────

ALTER TABLE "incentive_payout" ADD COLUMN "cycle_id" UUID, ADD COLUMN "policy_date" DATE;

UPDATE "incentive_payout" ip
SET "policy_date" = d."day"
FROM "_payout_policy_day" d
WHERE d."id" = ip."id";

UPDATE "incentive_payout" ip
SET "cycle_id" = c."id"
FROM "incentive_cycle" c
WHERE c."university_id" = ip."university_id" AND ip."policy_date" BETWEEN c."start_date" AND c."end_date";

CREATE INDEX "incentive_payout_cycle_id_school_id_idx" ON "incentive_payout"("cycle_id", "school_id");
ALTER TABLE "incentive_payout" ADD CONSTRAINT "incentive_payout_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "incentive_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Budget tables: financial_year → cycle_id ────────────────────────────────

ALTER TABLE "research_budget" ADD COLUMN "cycle_id" UUID;
ALTER TABLE "budget_allocation" ADD COLUMN "cycle_id" UUID;
ALTER TABLE "budget_allocation_event" ADD COLUMN "cycle_id" UUID;

UPDATE "research_budget" t SET "cycle_id" = c."id"
FROM "incentive_cycle" c
WHERE c."university_id" = t."university_id" AND c."start_date" = make_date(CAST(substring(t."financial_year" FROM 1 FOR 4) AS int), 4, 1);
UPDATE "budget_allocation" t SET "cycle_id" = b."cycle_id" FROM "research_budget" b WHERE b."id" = t."budget_id";
UPDATE "budget_allocation_event" t SET "cycle_id" = b."cycle_id" FROM "research_budget" b WHERE b."id" = t."budget_id";

DROP INDEX "research_budget_university_id_financial_year_key";
DROP INDEX "budget_allocation_university_id_financial_year_node_type_no_key";
DROP INDEX "budget_allocation_event_university_id_financial_year_idx";
ALTER TABLE "research_budget" DROP CONSTRAINT "research_budget_fy_format";

ALTER TABLE "research_budget" DROP COLUMN "financial_year", ALTER COLUMN "cycle_id" SET NOT NULL;
ALTER TABLE "budget_allocation" DROP COLUMN "financial_year", ALTER COLUMN "cycle_id" SET NOT NULL;
ALTER TABLE "budget_allocation_event" DROP COLUMN "financial_year", ALTER COLUMN "cycle_id" SET NOT NULL;

CREATE UNIQUE INDEX "research_budget_cycle_id_key" ON "research_budget"("cycle_id");
CREATE UNIQUE INDEX "budget_allocation_university_id_cycle_id_node_type_node_id_key" ON "budget_allocation"("university_id", "cycle_id", "node_type", "node_id");
CREATE INDEX "budget_allocation_event_university_id_cycle_id_idx" ON "budget_allocation_event"("university_id", "cycle_id");

ALTER TABLE "research_budget" ADD CONSTRAINT "research_budget_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "incentive_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budget_allocation" ADD CONSTRAINT "budget_allocation_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "incentive_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budget_allocation_event" ADD CONSTRAINT "budget_allocation_event_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "incentive_cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "_payout_policy_day";
DROP TABLE "_cycle_years";

-- ── Row-Level Security (same policy as every tenant-owned table; the budget tables had none) ──

ALTER TABLE "incentive_cycle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incentive_cycle" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "incentive_cycle" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

ALTER TABLE "research_budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_budget" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_budget" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

ALTER TABLE "budget_allocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_allocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "budget_allocation" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

ALTER TABLE "budget_allocation_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_allocation_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "budget_allocation_event" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

COMMIT;
