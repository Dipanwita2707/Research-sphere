-- Migration: Add new chat permissions
-- Date: 2026-02-12
-- Description: Add profile, privacy, customization, and notification permissions to chat groups

-- Add Profile & Media Permissions
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_upload_profile_photo BOOLEAN DEFAULT true;

-- Add Privacy Permissions
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_last_seen BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_online_status BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_profile_privacy BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_about_privacy BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_status_privacy BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_read_receipts BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_message_timer BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_set_groups_privacy BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_block_contacts BOOLEAN DEFAULT true;

-- Add Customization Permissions
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_change_theme BOOLEAN DEFAULT true;
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_change_wallpaper BOOLEAN DEFAULT true;

-- Add Notification Permissions
ALTER TABLE chat_group_permission ADD COLUMN IF NOT EXISTS can_toggle_notifications BOOLEAN DEFAULT true;

-- Update existing records to have all new permissions enabled by default
UPDATE chat_group_permission 
SET 
  can_upload_profile_photo = COALESCE(can_upload_profile_photo, true),
  can_set_last_seen = COALESCE(can_set_last_seen, true),
  can_set_online_status = COALESCE(can_set_online_status, true),
  can_set_profile_privacy = COALESCE(can_set_profile_privacy, true),
  can_set_about_privacy = COALESCE(can_set_about_privacy, true),
  can_set_status_privacy = COALESCE(can_set_status_privacy, true),
  can_set_read_receipts = COALESCE(can_set_read_receipts, true),
  can_set_message_timer = COALESCE(can_set_message_timer, true),
  can_set_groups_privacy = COALESCE(can_set_groups_privacy, true),
  can_block_contacts = COALESCE(can_block_contacts, true),
  can_change_theme = COALESCE(can_change_theme, true),
  can_change_wallpaper = COALESCE(can_change_wallpaper, true),
  can_toggle_notifications = COALESCE(can_toggle_notifications, true);

-- Add comment
COMMENT ON COLUMN chat_group_permission.can_upload_profile_photo IS 'Members can upload their profile photo';
COMMENT ON COLUMN chat_group_permission.can_set_last_seen IS 'Members can control last seen visibility';
COMMENT ON COLUMN chat_group_permission.can_set_online_status IS 'Members can control online status visibility';
COMMENT ON COLUMN chat_group_permission.can_set_profile_privacy IS 'Members can control who sees their profile picture';
COMMENT ON COLUMN chat_group_permission.can_set_about_privacy IS 'Members can control who sees their about info';
COMMENT ON COLUMN chat_group_permission.can_set_status_privacy IS 'Members can control who sees their status';
COMMENT ON COLUMN chat_group_permission.can_set_read_receipts IS 'Members can toggle read receipts';
COMMENT ON COLUMN chat_group_permission.can_set_message_timer IS 'Members can set disappearing message timer';
COMMENT ON COLUMN chat_group_permission.can_set_groups_privacy IS 'Members can control who can add them to groups';
COMMENT ON COLUMN chat_group_permission.can_block_contacts IS 'Members can block other users';
COMMENT ON COLUMN chat_group_permission.can_change_theme IS 'Members can customize their chat theme';
COMMENT ON COLUMN chat_group_permission.can_change_wallpaper IS 'Members can set custom chat wallpaper';
COMMENT ON COLUMN chat_group_permission.can_toggle_notifications IS 'Members can turn notifications on/off';
