-- AddColumn: template_body to loan_letter_template
ALTER TABLE "loan_letter_template"
  ADD COLUMN IF NOT EXISTS "template_body" TEXT;
