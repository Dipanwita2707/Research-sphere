ALTER TABLE loan_letter
ADD COLUMN IF NOT EXISTS student_email VARCHAR(256);

CREATE UNIQUE INDEX IF NOT EXISTS loan_letter_application_number_unique_ci
ON loan_letter (LOWER(application_number));
