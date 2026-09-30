-- CreateTable
CREATE TABLE IF NOT EXISTS "ipr_status_update" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "update_message" TEXT NOT NULL,
    "update_type" VARCHAR(64) NOT NULL,
    "priority" VARCHAR(32) NOT NULL DEFAULT 'medium',
    "is_visible_to_applicant" BOOLEAN NOT NULL DEFAULT true,
    "is_visible_to_inventors" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_status_update_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incentive_policy" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_type" VARCHAR(50) NOT NULL,
    "policy_name" VARCHAR(255) NOT NULL,
    "base_incentive_amount" DECIMAL(15,2) NOT NULL,
    "base_points" INTEGER NOT NULL,
    "split_policy" VARCHAR(50) NOT NULL,
    "primary_inventor_share" DECIMAL(5,2),
    "filing_type_multiplier" JSONB,
    "project_type_bonus" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incentive_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "ipr_updates" BOOLEAN NOT NULL DEFAULT true,
    "task_reminders" BOOLEAN NOT NULL DEFAULT true,
    "system_alerts" BOOLEAN NOT NULL DEFAULT true,
    "weekly_digest" BOOLEAN NOT NULL DEFAULT false,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'light',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "compact_view" BOOLEAN NOT NULL DEFAULT false,
    "show_tips" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ipr_status_update_ipr_application_id_idx" ON "ipr_status_update"("ipr_application_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ipr_status_update_created_by_id_idx" ON "ipr_status_update"("created_by_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ipr_status_update_update_type_idx" ON "ipr_status_update"("update_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "incentive_policy_ipr_type_idx" ON "incentive_policy"("ipr_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "incentive_policy_is_active_idx" ON "incentive_policy"("is_active");

-- CreateIndex (skip if already exists from previous migration)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'unique_active_policy_per_type'
    ) THEN
        CREATE UNIQUE INDEX "unique_active_policy_per_type" ON "incentive_policy"("ipr_type", "is_active");
    END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_user_id_key" ON "user_settings"("user_id");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ipr_status_update_ipr_application_id_fkey'
    ) THEN
        ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ipr_status_update_created_by_id_fkey'
    ) THEN
        ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'incentive_policy_created_by_id_fkey'
    ) THEN
        ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'incentive_policy_updated_by_id_fkey'
    ) THEN
        ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_fkey'
    ) THEN
        ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
