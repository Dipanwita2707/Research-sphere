-- Dynamic Affiliation Engine: admin-curated aliases on University, and
-- per-user affiliation override on UserSettings.
ALTER TABLE "universities" ADD COLUMN IF NOT EXISTS "affiliation_aliases" JSONB DEFAULT '[]';

ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "affiliation_override" VARCHAR(256);
