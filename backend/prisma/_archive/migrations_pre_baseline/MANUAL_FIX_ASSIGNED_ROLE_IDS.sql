-- Add missing assigned_role_ids column to user_login table
-- This column is used for role management feature

ALTER TABLE "user_login" 
ADD COLUMN IF NOT EXISTS "assigned_role_ids" JSONB DEFAULT '[]';

-- Update any null values to empty array
UPDATE "user_login" 
SET "assigned_role_ids" = '[]' 
WHERE "assigned_role_ids" IS NULL;
