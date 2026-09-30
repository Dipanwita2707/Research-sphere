-- Migration: Add Chat User Permission System
-- This migration:
-- 1. Creates the chat_user_permission table for per-user chat access control
-- 2. Removes user-level permission columns from chat_group_permission (they now belong to user-level)
-- Run this SQL manually against your database

-- Step 1: Create the chat_user_permission table
CREATE TABLE IF NOT EXISTS "chat_user_permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "can_private_message" BOOLEAN NOT NULL DEFAULT true,
    "can_create_group" BOOLEAN NOT NULL DEFAULT false,
    "can_upload_profile_photo" BOOLEAN NOT NULL DEFAULT true,
    "can_set_last_seen" BOOLEAN NOT NULL DEFAULT true,
    "can_set_online_status" BOOLEAN NOT NULL DEFAULT true,
    "can_set_profile_privacy" BOOLEAN NOT NULL DEFAULT true,
    "can_set_about_privacy" BOOLEAN NOT NULL DEFAULT true,
    "can_set_status_privacy" BOOLEAN NOT NULL DEFAULT true,
    "can_set_read_receipts" BOOLEAN NOT NULL DEFAULT true,
    "can_set_message_timer" BOOLEAN NOT NULL DEFAULT true,
    "can_set_groups_privacy" BOOLEAN NOT NULL DEFAULT true,
    "can_block_contacts" BOOLEAN NOT NULL DEFAULT true,
    "can_change_theme" BOOLEAN NOT NULL DEFAULT true,
    "can_change_wallpaper" BOOLEAN NOT NULL DEFAULT true,
    "can_toggle_notifications" BOOLEAN NOT NULL DEFAULT true,
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_user_permission_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS "chat_user_permission_user_id_key" ON "chat_user_permission"("user_id");

-- Step 3: Create index on chat_enabled for quick access checks
CREATE INDEX IF NOT EXISTS "chat_user_permission_chat_enabled_idx" ON "chat_user_permission"("chat_enabled");

-- Step 4: Add foreign key constraint to user_login
ALTER TABLE "chat_user_permission" 
ADD CONSTRAINT "chat_user_permission_user_id_fkey" 
FOREIGN KEY ("user_id") REFERENCES "user_login"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Remove user-level permission columns from chat_group_permission
-- These are now managed at the user level via chat_user_permission
-- Only run these if the columns exist (safe to run multiple times)
DO $$ 
BEGIN
    -- Remove user-level columns that have been moved to chat_user_permission
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_upload_profile_photo') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_upload_profile_photo";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_last_seen') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_last_seen";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_online_status') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_online_status";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_profile_privacy') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_profile_privacy";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_about_privacy') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_about_privacy";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_status_privacy') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_status_privacy";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_read_receipts') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_read_receipts";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_message_timer') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_message_timer";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_set_groups_privacy') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_set_groups_privacy";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_block_contacts') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_block_contacts";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_change_theme') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_change_theme";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_change_wallpaper') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_change_wallpaper";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_toggle_notifications') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_toggle_notifications";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_group_permission' AND column_name = 'can_create_group') THEN
        ALTER TABLE "chat_group_permission" DROP COLUMN "can_create_group";
    END IF;
END $$;

-- Step 6: Verify the migration
-- Run these queries to confirm:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_user_permission' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_group_permission' ORDER BY ordinal_position;
