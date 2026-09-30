-- Add canCreateGroup permission column
-- Generated: 2026-02-12

ALTER TABLE "chat_group_permission" 
ADD COLUMN IF NOT EXISTS "can_create_group" BOOLEAN NOT NULL DEFAULT true;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'chat_group_permission' 
AND column_name = 'can_create_group';
