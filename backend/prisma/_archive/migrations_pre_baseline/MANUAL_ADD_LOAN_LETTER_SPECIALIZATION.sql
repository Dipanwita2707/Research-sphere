-- Add specialization_id to loan_letter table
ALTER TABLE loan_letter
  ADD COLUMN IF NOT EXISTS specialization_id uuid REFERENCES program_specialization(id) ON DELETE SET NULL;
