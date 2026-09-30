-- AlterTable
ALTER TABLE "ipr_applicant_details" ADD COLUMN     "inventor_email" VARCHAR(256),
ADD COLUMN     "inventor_name" VARCHAR(256),
ADD COLUMN     "inventor_phone" VARCHAR(20),
ADD COLUMN     "inventor_uid" VARCHAR(64),
ADD COLUMN     "is_inventor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentor_name" VARCHAR(256),
ADD COLUMN     "mentor_uid" VARCHAR(64);
