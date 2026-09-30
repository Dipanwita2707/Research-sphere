-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ipr_status_enum" ADD VALUE 'recommended_to_head';
ALTER TYPE "ipr_status_enum" ADD VALUE 'submitted_to_govt';
ALTER TYPE "ipr_status_enum" ADD VALUE 'govt_application_filed';
ALTER TYPE "ipr_status_enum" ADD VALUE 'published';

-- AlterTable
ALTER TABLE "ipr_application" ADD COLUMN     "govt_application_id" VARCHAR(128),
ADD COLUMN     "govt_filing_date" TIMESTAMPTZ(6),
ADD COLUMN     "publication_date" TIMESTAMPTZ(6),
ADD COLUMN     "publication_id" VARCHAR(128);
