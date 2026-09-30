-- AlterTable
ALTER TABLE "user_login" ADD COLUMN     "assigned_role_ids" JSONB DEFAULT '[]';
