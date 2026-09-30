-- CreateTable
CREATE TABLE "ipr_contributor" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "user_id" UUID,
    "uid" VARCHAR(64),
    "name" VARCHAR(256) NOT NULL,
    "email" VARCHAR(256),
    "phone" VARCHAR(20),
    "department" VARCHAR(256),
    "employee_category" VARCHAR(64),
    "employee_type" VARCHAR(64),
    "role" VARCHAR(64) NOT NULL DEFAULT 'inventor',
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_contributor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ipr_contributor_ipr_application_id_idx" ON "ipr_contributor"("ipr_application_id");

-- CreateIndex
CREATE INDEX "ipr_contributor_user_id_idx" ON "ipr_contributor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_contributor_ipr_application_id_uid_key" ON "ipr_contributor"("ipr_application_id", "uid");

-- AddForeignKey
ALTER TABLE "ipr_contributor" ADD CONSTRAINT "ipr_contributor_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_contributor" ADD CONSTRAINT "ipr_contributor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
