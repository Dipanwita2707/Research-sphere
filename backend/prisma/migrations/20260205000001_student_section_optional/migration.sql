-- Make section_id optional on student_details (section not required for now)
ALTER TABLE "student_details" ALTER COLUMN "section_id" DROP NOT NULL;
