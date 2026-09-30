/*
  Warnings:

  - You are about to drop the column `mentor` on the `ipr_applicant_details` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ipr_applicant_details" DROP COLUMN "mentor";

-- CreateTable
CREATE TABLE "document_change" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "original_text" TEXT,
    "new_text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "reviewer_id" UUID NOT NULL,
    "comment" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_change_ipr_application_id_idx" ON "document_change"("ipr_application_id");

-- CreateIndex
CREATE INDEX "document_change_field_name_idx" ON "document_change"("field_name");

-- CreateIndex
CREATE INDEX "document_change_status_idx" ON "document_change"("status");

-- CreateIndex
CREATE INDEX "document_change_reviewer_id_idx" ON "document_change"("reviewer_id");

-- AddForeignKey
ALTER TABLE "document_change" ADD CONSTRAINT "document_change_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_change" ADD CONSTRAINT "document_change_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
