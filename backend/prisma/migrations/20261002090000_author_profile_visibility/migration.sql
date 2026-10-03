-- AlterTable
ALTER TABLE "research_profile_identity" ADD COLUMN     "allow_search_indexing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "profile_visibility" VARCHAR(16) NOT NULL DEFAULT 'institution',
ADD COLUMN     "public_handle" VARCHAR(80),
ADD COLUMN     "research_interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "show_co_authors" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_email" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "show_metrics" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_phone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "show_publications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_research_interests" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "research_profile_identity_university_id_public_handle_key" ON "research_profile_identity"("university_id", "public_handle");

-- Only the three supported visibility levels.
ALTER TABLE "research_profile_identity"
  ADD CONSTRAINT "research_profile_identity_profile_visibility_check"
  CHECK ("profile_visibility" IN ('public', 'institution', 'private'));
