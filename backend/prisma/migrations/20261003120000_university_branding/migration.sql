-- AlterTable
ALTER TABLE "universities" ADD COLUMN     "accent_color" VARCHAR(16),
ADD COLUMN     "branding_updated_at" TIMESTAMPTZ(6),
ADD COLUMN     "display_name" VARCHAR(256),
ADD COLUMN     "favicon_key" VARCHAR(512),
ADD COLUMN     "hero_heading" VARCHAR(120),
ADD COLUMN     "hero_subheading" VARCHAR(280),
ADD COLUMN     "logo_dark_key" VARCHAR(512),
ADD COLUMN     "short_name" VARCHAR(32),
ADD COLUMN     "tagline" VARCHAR(160),
ADD COLUMN     "theme_preset" VARCHAR(32) NOT NULL DEFAULT 'classic-wine';
