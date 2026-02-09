-- AlterTable
ALTER TABLE "student_details" ADD COLUMN "mentor_id" UUID;

-- AddForeignKey
ALTER TABLE "student_details" ADD CONSTRAINT "student_details_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
