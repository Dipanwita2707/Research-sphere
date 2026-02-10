-- CreateEnum
CREATE TYPE "RoleDepartmentType" AS ENUM ('SCHOOL', 'CENTRAL', 'BOTH');

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "department_type" "RoleDepartmentType" NOT NULL DEFAULT 'BOTH',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "requires_department_assignment" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");
