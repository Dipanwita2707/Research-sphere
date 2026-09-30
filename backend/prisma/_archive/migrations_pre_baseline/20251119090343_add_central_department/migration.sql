-- CreateTable
CREATE TABLE "central_department" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "department_code" VARCHAR(32) NOT NULL,
    "department_name" VARCHAR(256) NOT NULL,
    "short_name" VARCHAR(64),
    "description" TEXT,
    "head_of_department" UUID,
    "contact_email" CITEXT,
    "contact_phone" VARCHAR(20),
    "office_location" TEXT,
    "department_type" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "central_department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "central_department_department_code_key" ON "central_department"("department_code");

-- AddForeignKey
ALTER TABLE "central_department" ADD CONSTRAINT "central_department_head_of_department_fkey" FOREIGN KEY ("head_of_department") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
