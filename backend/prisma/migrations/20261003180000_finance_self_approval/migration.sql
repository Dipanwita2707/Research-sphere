-- Per-university finance rules. allow_self_approval lets the person who prepared a payment batch
-- (or recommended its lines) approve it with a reason; off by default (two-person rule).
-- payout_batch.self_approved marks batches approved that way.
BEGIN;

CREATE TABLE "finance_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "allow_self_approval" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_settings_university_id_key" ON "finance_settings"("university_id");

ALTER TABLE "finance_settings" ADD CONSTRAINT "finance_settings_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance_settings" ADD CONSTRAINT "finance_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payout_batch" ADD COLUMN "self_approved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "finance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "finance_settings" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

COMMIT;
