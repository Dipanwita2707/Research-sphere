-- Add student phone to loan_letter
ALTER TABLE "loan_letter"
ADD COLUMN IF NOT EXISTS "student_phone" VARCHAR(32);
