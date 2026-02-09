-- CreateEnum
CREATE TYPE "note_category_enum" AS ENUM ('academic', 'administrative');
CREATE TYPE "note_status_enum" AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE "note_approval_period_enum" AS ENUM ('one_time', 'recurring');
CREATE TYPE "note_recurring_frequency_enum" AS ENUM ('weekly', 'monthly', 'quarterly', 'half_yearly', 'annually');

-- CreateTable
CREATE TABLE "note" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "noting_id" VARCHAR(64) NOT NULL,
    "category" "note_category_enum" NOT NULL,
    "subcategory" VARCHAR(64) NOT NULL,
    "description" TEXT NOT NULL,
    "approval_period" "note_approval_period_enum" NOT NULL,
    "recurring_frequency" "note_recurring_frequency_enum",
    "policy_within_sgtu" BOOLEAN,
    "policy_outside_sgtu" BOOLEAN,
    "policy_both" BOOLEAN,
    "policy_justification" TEXT,
    "amount_required" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(12,2),
    "status" "note_status_enum" NOT NULL DEFAULT 'draft',
    "created_by_id" UUID NOT NULL,
    "current_holder_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_point" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "note_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "note_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "note_id" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "remarks" TEXT,
    "next_holder_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_attachment" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "note_id" UUID NOT NULL,
    "file_path" VARCHAR(512) NOT NULL,
    "file_name" VARCHAR(256) NOT NULL,

    CONSTRAINT "note_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "noting_authority" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "role_key" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "noting_authority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "note_noting_id_key" ON "note"("noting_id");

-- CreateIndex
CREATE UNIQUE INDEX "noting_authority_role_key_key" ON "noting_authority"("role_key");

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "note" ADD CONSTRAINT "note_current_holder_id_fkey" FOREIGN KEY ("current_holder_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "note_point" ADD CONSTRAINT "note_point_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_history" ADD CONSTRAINT "note_history_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_history" ADD CONSTRAINT "note_history_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "note_history" ADD CONSTRAINT "note_history_next_holder_id_fkey" FOREIGN KEY ("next_holder_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "noting_authority" ADD CONSTRAINT "noting_authority_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
