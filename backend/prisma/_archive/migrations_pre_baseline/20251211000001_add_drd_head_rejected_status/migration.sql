-- Add drd_head_rejected status to IprStatusEnum
ALTER TYPE "ipr_status_enum" ADD VALUE IF NOT EXISTS 'drd_head_rejected';
