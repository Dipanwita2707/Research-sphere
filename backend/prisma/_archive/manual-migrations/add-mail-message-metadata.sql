-- Add metadata JSONB column to mail_message table
-- This stores original group recipient info (dept:/school:/cdept: prefixes)
-- so the sent mail view can show "mailed via Department / School / Central Dept"

ALTER TABLE mail_message
  ADD COLUMN IF NOT EXISTS metadata JSONB;
