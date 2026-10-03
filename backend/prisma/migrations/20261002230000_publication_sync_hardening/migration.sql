-- AlterTable
ALTER TABLE "research_profile_identity" ADD COLUMN     "identity_verification" JSONB,
ADD COLUMN     "next_sync_at" TIMESTAMPTZ(6),
ADD COLUMN     "openalex_author_id" VARCHAR(256);

-- AlterTable
ALTER TABLE "universities" ADD COLUMN     "scopus_affiliation_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "research_profile_identity_auto_sync_enabled_next_sync_at_idx" ON "research_profile_identity"("auto_sync_enabled", "next_sync_at");

-- Data: SGT University's known Scopus affiliation ids (previously hard-coded in
-- publicationSync.service.js). Only touches the tenant whose code is 'SGT', and only
-- when it has no ids configured yet.
UPDATE "universities"
SET "scopus_affiliation_ids" = ARRAY['60113772', '124037491', '123581218', '133421016']::TEXT[]
WHERE "code" = 'SGT' AND COALESCE(cardinality("scopus_affiliation_ids"), 0) = 0;

-- Data: schedule existing profiles from their last sync so the nightly job does not
-- treat every profile as due at once.
UPDATE "research_profile_identity"
SET "next_sync_at" = "last_synced_at" + make_interval(days => GREATEST("sync_frequency_days", 1))
WHERE "last_synced_at" IS NOT NULL AND "next_sync_at" IS NULL;
