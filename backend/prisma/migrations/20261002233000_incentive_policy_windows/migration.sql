-- Incentive-policy effective windows: one model for every policy type (research, book,
-- book chapter, conference, grant, IPR).
--
--   * is_active means "enabled by an admin"; it is no longer derived from dates.
--   * The policy that applies to a date is the enabled one whose [effective_from, effective_to]
--     window covers it.
--   * Enabled policies of the same university and key never overlap. Enforced below with
--     tenant-scoped EXCLUDE constraints (Prisma cannot model these; `prisma migrate diff`
--     ignores them, so they do not show up as drift).
--
-- Why not a partial UNIQUE (university_id, publication_type) WHERE is_active: that allows
-- only ONE enabled policy per type, so the previous version (e.g. 2025) would have to be
-- disabled when the 2026 one is created, and publications dated 2025 would then match no
-- policy (₹0). The exclusion constraint gives the guarantee that matters — never two
-- enabled policies for the same tenant/type on the same date — and keeps old versions usable.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- IPR: (university_id, ipr_type, is_active) allowed only ONE disabled version per type, so
-- saving a third version failed with a unique violation (500).
-- DropIndex
DROP INDEX "incentive_policy_university_id_ipr_type_is_active_key";

-- Research: this partial unique index was created outside migrations (schema drift) and was
-- NOT tenant-scoped — one university's active research_paper policy blocked every other
-- university's.
DROP INDEX IF EXISTS "unique_active_research_policy_per_type";

-- ── Data: is_active was derived from dates (research) or flipped off when superseded (IPR).
-- Re-enable such versions when their window overlaps no other version of the same key, so
-- publications dated inside them select them again. Rows that overlap another version are
-- left as they are.
UPDATE "research_incentive_policy" p
SET "is_active" = true, "updated_at" = now()
WHERE p."is_active" = false
  AND NOT EXISTS (
    SELECT 1 FROM "research_incentive_policy" o
    WHERE o."id" <> p."id"
      AND o."university_id" = p."university_id"
      AND o."publication_type" = p."publication_type"
      AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  );

UPDATE "incentive_policy" p
SET "is_active" = true, "updated_at" = now()
WHERE p."is_active" = false
  AND p."effective_to" IS NOT NULL -- superseded versions (explicitly-disabled open-ended ones stay off)
  AND NOT EXISTS (
    SELECT 1 FROM "incentive_policy" o
    WHERE o."id" <> p."id"
      AND o."university_id" = p."university_id"
      AND o."ipr_type" = p."ipr_type"
      AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  );

-- ── Data: research author split. The admin UI saved first/corresponding author % only in
-- indexing_bonuses.rolePercentages while the calculator read the columns (left at the
-- 40/40 or 40/30 defaults). Copy the admin's values into the columns, and the position
-- table into position_based_distribution when that column is empty.
UPDATE "research_incentive_policy" p
SET "first_author_percentage" = (
      SELECT (r->>'percentage')::numeric FROM jsonb_array_elements(p."indexing_bonuses"->'rolePercentages') r
      WHERE r->>'role' = 'first_author' LIMIT 1),
    "updated_at" = now()
WHERE jsonb_typeof(p."indexing_bonuses"->'rolePercentages') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p."indexing_bonuses"->'rolePercentages') r
    WHERE r->>'role' = 'first_author' AND (r->>'percentage') ~ '^[0-9]+(\.[0-9]+)?$'
      AND (r->>'percentage')::numeric BETWEEN 0 AND 100
      AND (r->>'percentage')::numeric IS DISTINCT FROM p."first_author_percentage");

UPDATE "research_incentive_policy" p
SET "corresponding_author_percentage" = (
      SELECT (r->>'percentage')::numeric FROM jsonb_array_elements(p."indexing_bonuses"->'rolePercentages') r
      WHERE r->>'role' = 'corresponding_author' LIMIT 1),
    "updated_at" = now()
WHERE jsonb_typeof(p."indexing_bonuses"->'rolePercentages') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p."indexing_bonuses"->'rolePercentages') r
    WHERE r->>'role' = 'corresponding_author' AND (r->>'percentage') ~ '^[0-9]+(\.[0-9]+)?$'
      AND (r->>'percentage')::numeric BETWEEN 0 AND 100
      AND (r->>'percentage')::numeric IS DISTINCT FROM p."corresponding_author_percentage");

UPDATE "research_incentive_policy" p
SET "position_based_distribution" = (
      SELECT jsonb_object_agg(e->>'position', (e->>'percentage')::numeric) || '{"6+": 0}'::jsonb
      FROM jsonb_array_elements(p."indexing_bonuses"->'positionPercentages') e),
    "updated_at" = now()
WHERE p."position_based_distribution" IS NULL
  AND jsonb_typeof(p."indexing_bonuses"->'positionPercentages') = 'array'
  AND jsonb_array_length(p."indexing_bonuses"->'positionPercentages') > 0;

-- ── Data: enabled policies that already overlap (possible only through the old bugs) would
-- block the constraints. Keep the most recently created one enabled, disable the older
-- overlapping ones (rows are kept, nothing is deleted).
UPDATE "research_incentive_policy" p SET "is_active" = false, "updated_at" = now()
WHERE p."is_active" AND EXISTS (SELECT 1 FROM "research_incentive_policy" o WHERE o."is_active" AND o."id" <> p."id"
  AND o."university_id" = p."university_id" AND o."publication_type" = p."publication_type"
  AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  AND (o."created_at", o."id") > (p."created_at", p."id"));

UPDATE "book_incentive_policy" p SET "is_active" = false, "updated_at" = now()
WHERE p."is_active" AND EXISTS (SELECT 1 FROM "book_incentive_policy" o WHERE o."is_active" AND o."id" <> p."id"
  AND o."university_id" = p."university_id"
  AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  AND (o."created_at", o."id") > (p."created_at", p."id"));

UPDATE "book_chapter_incentive_policy" p SET "is_active" = false, "updated_at" = now()
WHERE p."is_active" AND EXISTS (SELECT 1 FROM "book_chapter_incentive_policy" o WHERE o."is_active" AND o."id" <> p."id"
  AND o."university_id" = p."university_id"
  AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  AND (o."created_at", o."id") > (p."created_at", p."id"));

UPDATE "conference_incentive_policy" p SET "is_active" = false, "updated_at" = now()
WHERE p."is_active" AND EXISTS (SELECT 1 FROM "conference_incentive_policy" o WHERE o."is_active" AND o."id" <> p."id"
  AND o."university_id" = p."university_id" AND o."conference_sub_type" = p."conference_sub_type"
  AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  AND (o."created_at", o."id") > (p."created_at", p."id"));

UPDATE "grant_incentive_policy" p SET "is_active" = false, "updated_at" = now()
WHERE p."is_active" AND EXISTS (SELECT 1 FROM "grant_incentive_policy" o WHERE o."is_active" AND o."id" <> p."id"
  AND o."university_id" = p."university_id" AND o."project_category" = p."project_category" AND o."project_type" = p."project_type"
  AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  AND (o."created_at", o."id") > (p."created_at", p."id"));

UPDATE "incentive_policy" p SET "is_active" = false, "updated_at" = now()
WHERE p."is_active" AND EXISTS (SELECT 1 FROM "incentive_policy" o WHERE o."is_active" AND o."id" <> p."id"
  AND o."university_id" = p."university_id" AND o."ipr_type" = p."ipr_type"
  AND tstzrange(o."effective_from", o."effective_to", '[]') && tstzrange(p."effective_from", p."effective_to", '[]')
  AND (o."created_at", o."id") > (p."created_at", p."id"));

-- ── Constraints: no two ENABLED policies of the same university + key on the same date.
ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_no_overlap"
  EXCLUDE USING gist ("university_id" WITH =, "publication_type" WITH =,
    tstzrange("effective_from", "effective_to", '[]') WITH &&) WHERE ("is_active");

ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_no_overlap"
  EXCLUDE USING gist ("university_id" WITH =,
    tstzrange("effective_from", "effective_to", '[]') WITH &&) WHERE ("is_active");

ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_no_overlap"
  EXCLUDE USING gist ("university_id" WITH =,
    tstzrange("effective_from", "effective_to", '[]') WITH &&) WHERE ("is_active");

ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_no_overlap"
  EXCLUDE USING gist ("university_id" WITH =, "conference_sub_type" WITH =,
    tstzrange("effective_from", "effective_to", '[]') WITH &&) WHERE ("is_active");

ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_no_overlap"
  EXCLUDE USING gist ("university_id" WITH =, "project_category" WITH =, "project_type" WITH =,
    tstzrange("effective_from", "effective_to", '[]') WITH &&) WHERE ("is_active");

ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_no_overlap"
  EXCLUDE USING gist ("university_id" WITH =, "ipr_type" WITH =,
    tstzrange("effective_from", "effective_to", '[]') WITH &&) WHERE ("is_active");

-- A window may not end before it starts (also validated by the API).
ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_window_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_window_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_window_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_window_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_window_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_window_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
