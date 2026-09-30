/*
  Warnings:

  - You are about to drop the column `department_id` on the `employee_details` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "employee_details" DROP CONSTRAINT "employee_details_department_id_fkey";

-- AlterTable
ALTER TABLE "employee_details" DROP COLUMN "department_id",
ADD COLUMN     "primary_central_dept_id" UUID,
ADD COLUMN     "primary_department_id" UUID;

-- CreateTable
CREATE TABLE "department_permission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "central_department_permission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "central_dept_id" UUID NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_department_permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_permission_user_id_idx" ON "department_permission"("user_id");

-- CreateIndex
CREATE INDEX "department_permission_department_id_idx" ON "department_permission"("department_id");

-- CreateIndex
CREATE INDEX "department_permission_is_primary_idx" ON "department_permission"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "department_permission_user_id_department_id_key" ON "department_permission"("user_id", "department_id");

-- CreateIndex
CREATE INDEX "central_department_permission_user_id_idx" ON "central_department_permission"("user_id");

-- CreateIndex
CREATE INDEX "central_department_permission_central_dept_id_idx" ON "central_department_permission"("central_dept_id");

-- CreateIndex
CREATE INDEX "central_department_permission_is_primary_idx" ON "central_department_permission"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "central_department_permission_user_id_central_dept_id_key" ON "central_department_permission"("user_id", "central_dept_id");

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_primary_department_id_fkey" FOREIGN KEY ("primary_department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_primary_central_dept_id_fkey" FOREIGN KEY ("primary_central_dept_id") REFERENCES "central_department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_permission" ADD CONSTRAINT "department_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_permission" ADD CONSTRAINT "department_permission_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_permission" ADD CONSTRAINT "department_permission_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department_permission" ADD CONSTRAINT "central_department_permission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department_permission" ADD CONSTRAINT "central_department_permission_central_dept_id_fkey" FOREIGN KEY ("central_dept_id") REFERENCES "central_department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_department_permission" ADD CONSTRAINT "central_department_permission_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
