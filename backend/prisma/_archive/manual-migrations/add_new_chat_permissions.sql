-- Add new chat permission columns to chat_group_permission table
-- Generated: 2026-02-12

ALTER TABLE "chat_group_permission" 
ADD COLUMN IF NOT EXISTS "can_upload_profile_photo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_last_seen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_online_status" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_profile_privacy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_about_privacy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_status_privacy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_read_receipts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_message_timer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_set_groups_privacy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_block_contacts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_change_theme" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_change_wallpaper" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "can_toggle_notifications" BOOLEAN NOT NULL DEFAULT true;

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'chat_group_permission' 
AND column_name IN (
  'can_upload_profile_photo',
  'can_set_last_seen',
  'can_set_online_status',
  'can_set_profile_privacy',
  'can_set_about_privacy',
  'can_set_status_privacy',
  'can_set_read_receipts',
  'can_set_message_timer',
  'can_set_groups_privacy',
  'can_block_contacts',
  'can_change_theme',
  'can_change_wallpaper',
  'can_toggle_notifications'
)
ORDER BY column_name;
