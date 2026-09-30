-- Add govt_rejected status to IprStatusEnum
ALTER TYPE "ipr_status_enum" ADD VALUE IF NOT EXISTS 'govt_rejected';
