-- AlterTable
ALTER TABLE "role" ADD COLUMN     "assigned_department_ids" JSONB,
ADD COLUMN     "assigned_school_ids" JSONB;
