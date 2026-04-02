-- Migration: Create Chat Core Tables (safe/idempotent)
-- Purpose: Create missing chat tables without destructive schema sync

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_member_role_enum') THEN
    CREATE TYPE "chat_member_role_enum" AS ENUM ('owner', 'admin', 'moderator', 'member');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_type_enum') THEN
    CREATE TYPE "chat_message_type_enum" AS ENUM ('text', 'file', 'image', 'voice', 'video', 'document');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'last_seen_privacy_enum') THEN
    CREATE TYPE "last_seen_privacy_enum" AS ENUM ('everyone', 'contacts', 'nobody');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "chat_group" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "avatar" VARCHAR(255),
  "created_by_id" UUID NOT NULL,
  "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_group_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_group_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_group_created_by_id_idx" ON "chat_group"("created_by_id");
CREATE INDEX IF NOT EXISTS "chat_group_is_active_idx" ON "chat_group"("is_active");
CREATE INDEX IF NOT EXISTS "chat_group_created_at_idx" ON "chat_group"("created_at");

CREATE TABLE IF NOT EXISTS "chat_group_member" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "group_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "member_role" "chat_member_role_enum" NOT NULL DEFAULT 'member',
  "custom_permissions" JSONB,
  "is_muted" BOOLEAN NOT NULL DEFAULT false,
  "muted_until" TIMESTAMPTZ(6),
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_group_member_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_group_member_group_id_user_id_key" UNIQUE ("group_id", "user_id"),
  CONSTRAINT "chat_group_member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "chat_group"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_group_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_group_member_user_id_idx" ON "chat_group_member"("user_id");
CREATE INDEX IF NOT EXISTS "chat_group_member_group_id_idx" ON "chat_group_member"("group_id");
CREATE INDEX IF NOT EXISTS "chat_group_member_member_role_idx" ON "chat_group_member"("member_role");

CREATE TABLE IF NOT EXISTS "chat_group_permission" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "group_id" UUID NOT NULL,
  "can_send_message" BOOLEAN NOT NULL DEFAULT true,
  "can_upload_files" BOOLEAN NOT NULL DEFAULT true,
  "can_send_voice" BOOLEAN NOT NULL DEFAULT true,
  "can_send_video" BOOLEAN NOT NULL DEFAULT true,
  "can_send_emoji" BOOLEAN NOT NULL DEFAULT true,
  "can_edit_message" BOOLEAN NOT NULL DEFAULT true,
  "can_delete_message" BOOLEAN NOT NULL DEFAULT true,
  "can_pin_message" BOOLEAN NOT NULL DEFAULT false,
  "can_mention_all" BOOLEAN NOT NULL DEFAULT false,
  "can_add_members" BOOLEAN NOT NULL DEFAULT false,
  "can_remove_members" BOOLEAN NOT NULL DEFAULT false,
  "admin_only_messaging" BOOLEAN NOT NULL DEFAULT false,
  "read_only_mode" BOOLEAN NOT NULL DEFAULT false,
  "private_dm_allowed" BOOLEAN NOT NULL DEFAULT true,
  "search_members" BOOLEAN NOT NULL DEFAULT true,
  "max_file_size" INTEGER NOT NULL DEFAULT 10485760,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_group_permission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_group_permission_group_id_key" UNIQUE ("group_id"),
  CONSTRAINT "chat_group_permission_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "chat_group"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "chat_message" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "group_id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "message_type" "chat_message_type_enum" NOT NULL DEFAULT 'text',
  "content" TEXT,
  "encrypted_content" TEXT,
  "file_path" VARCHAR(500),
  "file_name" VARCHAR(255),
  "file_size" INTEGER,
  "mime_type" VARCHAR(100),
  "duration" INTEGER,
  "waveform_data" JSONB,
  "reply_to_id" UUID,
  "mentions" JSONB,
  "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  "is_edited" BOOLEAN NOT NULL DEFAULT false,
  "read_by" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_message_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "chat_group"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user_login"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "chat_message"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "chat_message_group_id_created_at_idx" ON "chat_message"("group_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_message_sender_id_idx" ON "chat_message"("sender_id");
CREATE INDEX IF NOT EXISTS "chat_message_message_type_idx" ON "chat_message"("message_type");
CREATE INDEX IF NOT EXISTS "chat_message_is_pinned_idx" ON "chat_message"("is_pinned");
CREATE INDEX IF NOT EXISTS "chat_message_is_deleted_idx" ON "chat_message"("is_deleted");

CREATE TABLE IF NOT EXISTS "direct_message" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "sender_id" UUID NOT NULL,
  "receiver_id" UUID NOT NULL,
  "message_type" "chat_message_type_enum" NOT NULL DEFAULT 'text',
  "content" TEXT,
  "encrypted_content" TEXT,
  "file_path" VARCHAR(500),
  "file_name" VARCHAR(255),
  "file_size" INTEGER,
  "mime_type" VARCHAR(100),
  "duration" INTEGER,
  "waveform_data" JSONB,
  "reply_to_id" UUID,
  "is_edited" BOOLEAN NOT NULL DEFAULT false,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user_login"("id") ON DELETE CASCADE,
  CONSTRAINT "direct_message_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "user_login"("id") ON DELETE CASCADE,
  CONSTRAINT "direct_message_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "direct_message"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "direct_message_sender_receiver_created_idx" ON "direct_message"("sender_id", "receiver_id", "created_at");
CREATE INDEX IF NOT EXISTS "direct_message_receiver_sender_created_idx" ON "direct_message"("receiver_id", "sender_id", "created_at");
CREATE INDEX IF NOT EXISTS "direct_message_read_at_idx" ON "direct_message"("read_at");

CREATE TABLE IF NOT EXISTS "user_chat_status" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "is_online" BOOLEAN NOT NULL DEFAULT false,
  "last_seen_at" TIMESTAMPTZ(6),
  "socket_id" VARCHAR(100),
  "last_seen_privacy" "last_seen_privacy_enum" NOT NULL DEFAULT 'everyone',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_chat_status_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_chat_status_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "user_chat_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_chat_status_is_online_idx" ON "user_chat_status"("is_online");
CREATE INDEX IF NOT EXISTS "user_chat_status_last_seen_at_idx" ON "user_chat_status"("last_seen_at");

CREATE TABLE IF NOT EXISTS "chat_user_permission" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
  "can_private_message" BOOLEAN NOT NULL DEFAULT true,
  "can_create_group" BOOLEAN NOT NULL DEFAULT true,
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
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_user_permission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_user_permission_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "chat_user_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_user_permission_chat_enabled_idx" ON "chat_user_permission"("chat_enabled");
CREATE INDEX IF NOT EXISTS "chat_user_permission_user_id_idx" ON "chat_user_permission"("user_id");
