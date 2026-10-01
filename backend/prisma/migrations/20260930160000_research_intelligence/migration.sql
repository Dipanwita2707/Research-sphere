-- CreateTable
CREATE TABLE "rip_research_keyword" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "canonical_name" VARCHAR(256) NOT NULL,
    "slug" VARCHAR(256) NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publication_count" INTEGER NOT NULL DEFAULT 0,
    "researcher_count" INTEGER NOT NULL DEFAULT 0,
    "total_citations" INTEGER NOT NULL DEFAULT 0,
    "yearly_volume" JSONB NOT NULL DEFAULT '{}',
    "growth_rate" DECIMAL(10,4),
    "momentum" DECIMAL(10,4),
    "citation_influence" DECIMAL(12,4),
    "school_count" INTEGER NOT NULL DEFAULT 0,
    "department_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_year" INTEGER,
    "last_computed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_research_keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_contribution_keyword" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "contribution_id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "raw_term" VARCHAR(256),
    "extraction_source" VARCHAR(32) NOT NULL,
    "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_contribution_keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_taxonomy_domain" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "icon_code" VARCHAR(64),
    "color_hex" VARCHAR(16),
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "origin" VARCHAR(16) NOT NULL DEFAULT 'manual',
    "publication_count" INTEGER NOT NULL DEFAULT 0,
    "researcher_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_taxonomy_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_taxonomy_category" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "origin" VARCHAR(16) NOT NULL DEFAULT 'manual',
    "merged_into_category_id" UUID,
    "publication_count" INTEGER NOT NULL DEFAULT 0,
    "researcher_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_taxonomy_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_taxonomy_specialization" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "origin" VARCHAR(16) NOT NULL DEFAULT 'manual',
    "publication_count" INTEGER NOT NULL DEFAULT 0,
    "researcher_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_taxonomy_specialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_keyword_taxonomy_mapping" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "keyword_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "specialization_id" UUID,
    "source" VARCHAR(16) NOT NULL DEFAULT 'ai',
    "confidence_score" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(16) NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_keyword_taxonomy_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_researcher_topic_score" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "pub_count" INTEGER NOT NULL DEFAULT 0,
    "citation_count" INTEGER NOT NULL DEFAULT 0,
    "recent_pub_count" INTEGER NOT NULL DEFAULT 0,
    "first_year" INTEGER,
    "last_year" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_researcher_topic_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_researcher_expertise_profile" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "primary_category_id" UUID,
    "total_pubs" INTEGER NOT NULL DEFAULT 0,
    "total_citations" INTEGER NOT NULL DEFAULT 0,
    "h_index" INTEGER NOT NULL DEFAULT 0,
    "recent_pubs" INTEGER NOT NULL DEFAULT 0,
    "collaborator_count" INTEGER NOT NULL DEFAULT 0,
    "external_collabs" INTEGER NOT NULL DEFAULT 0,
    "active_years" INTEGER NOT NULL DEFAULT 0,
    "top_keyword_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "last_computed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_researcher_expertise_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_ai_cache" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "cache_key" VARCHAR(64) NOT NULL,
    "context" VARCHAR(64),
    "provider" VARCHAR(32),
    "response" JSONB NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_ai_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_chat_session" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(256),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_chat_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_chat_message" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "tool_trace" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "provider" VARCHAR(32),
    "model" VARCHAR(96),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "response_time_ms" INTEGER,
    "feedback" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_pipeline_run" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "triggered_by_id" UUID,
    "status" VARCHAR(16) NOT NULL DEFAULT 'queued',
    "stage" VARCHAR(32),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL DEFAULT '{}',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_pipeline_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_module" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "module_key" VARCHAR(64) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "notes" VARCHAR(512),
    "enabled_by_id" UUID,
    "enabled_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rip_user_access" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "granted_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "note" VARCHAR(256),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rip_user_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rip_research_keyword_university_id_publication_count_idx" ON "rip_research_keyword"("university_id", "publication_count");

-- CreateIndex
CREATE INDEX "rip_research_keyword_university_id_momentum_idx" ON "rip_research_keyword"("university_id", "momentum");

-- CreateIndex
CREATE UNIQUE INDEX "rip_research_keyword_university_id_slug_key" ON "rip_research_keyword"("university_id", "slug");

-- CreateIndex
CREATE INDEX "rip_contribution_keyword_keyword_id_idx" ON "rip_contribution_keyword"("keyword_id");

-- CreateIndex
CREATE INDEX "rip_contribution_keyword_university_id_idx" ON "rip_contribution_keyword"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "rip_contribution_keyword_contribution_id_keyword_id_key" ON "rip_contribution_keyword"("contribution_id", "keyword_id");

-- CreateIndex
CREATE INDEX "rip_taxonomy_domain_university_id_status_idx" ON "rip_taxonomy_domain"("university_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rip_taxonomy_domain_university_id_slug_key" ON "rip_taxonomy_domain"("university_id", "slug");

-- CreateIndex
CREATE INDEX "rip_taxonomy_category_university_id_status_idx" ON "rip_taxonomy_category"("university_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rip_taxonomy_category_domain_id_slug_key" ON "rip_taxonomy_category"("domain_id", "slug");

-- CreateIndex
CREATE INDEX "rip_taxonomy_specialization_university_id_idx" ON "rip_taxonomy_specialization"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "rip_taxonomy_specialization_category_id_slug_key" ON "rip_taxonomy_specialization"("category_id", "slug");

-- CreateIndex
CREATE INDEX "rip_keyword_taxonomy_mapping_specialization_id_idx" ON "rip_keyword_taxonomy_mapping"("specialization_id");

-- CreateIndex
CREATE INDEX "rip_keyword_taxonomy_mapping_category_id_idx" ON "rip_keyword_taxonomy_mapping"("category_id");

-- CreateIndex
CREATE INDEX "rip_keyword_taxonomy_mapping_university_id_status_idx" ON "rip_keyword_taxonomy_mapping"("university_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rip_keyword_taxonomy_mapping_keyword_id_category_id_key" ON "rip_keyword_taxonomy_mapping"("keyword_id", "category_id");

-- CreateIndex
CREATE INDEX "rip_researcher_topic_score_university_id_category_id_score_idx" ON "rip_researcher_topic_score"("university_id", "category_id", "score");

-- CreateIndex
CREATE UNIQUE INDEX "rip_researcher_topic_score_user_id_category_id_key" ON "rip_researcher_topic_score"("user_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "rip_researcher_expertise_profile_user_id_key" ON "rip_researcher_expertise_profile"("user_id");

-- CreateIndex
CREATE INDEX "rip_researcher_expertise_profile_university_id_primary_cate_idx" ON "rip_researcher_expertise_profile"("university_id", "primary_category_id");

-- CreateIndex
CREATE INDEX "rip_ai_cache_expires_at_idx" ON "rip_ai_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "rip_ai_cache_university_id_cache_key_key" ON "rip_ai_cache"("university_id", "cache_key");

-- CreateIndex
CREATE INDEX "rip_chat_session_university_id_user_id_last_active_at_idx" ON "rip_chat_session"("university_id", "user_id", "last_active_at");

-- CreateIndex
CREATE INDEX "rip_chat_message_session_id_created_at_idx" ON "rip_chat_message"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "rip_chat_message_university_id_idx" ON "rip_chat_message"("university_id");

-- CreateIndex
CREATE INDEX "rip_pipeline_run_university_id_created_at_idx" ON "rip_pipeline_run"("university_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "university_module_university_id_module_key_key" ON "university_module"("university_id", "module_key");

-- CreateIndex
CREATE UNIQUE INDEX "rip_user_access_user_id_key" ON "rip_user_access"("user_id");

-- CreateIndex
CREATE INDEX "rip_user_access_university_id_idx" ON "rip_user_access"("university_id");

-- AddForeignKey
ALTER TABLE "rip_research_keyword" ADD CONSTRAINT "rip_research_keyword_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_contribution_keyword" ADD CONSTRAINT "rip_contribution_keyword_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_contribution_keyword" ADD CONSTRAINT "rip_contribution_keyword_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "research_contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_contribution_keyword" ADD CONSTRAINT "rip_contribution_keyword_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "rip_research_keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_taxonomy_domain" ADD CONSTRAINT "rip_taxonomy_domain_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_taxonomy_category" ADD CONSTRAINT "rip_taxonomy_category_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_taxonomy_category" ADD CONSTRAINT "rip_taxonomy_category_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "rip_taxonomy_domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_taxonomy_specialization" ADD CONSTRAINT "rip_taxonomy_specialization_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_taxonomy_specialization" ADD CONSTRAINT "rip_taxonomy_specialization_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "rip_taxonomy_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_keyword_taxonomy_mapping" ADD CONSTRAINT "rip_keyword_taxonomy_mapping_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_keyword_taxonomy_mapping" ADD CONSTRAINT "rip_keyword_taxonomy_mapping_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "rip_research_keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_keyword_taxonomy_mapping" ADD CONSTRAINT "rip_keyword_taxonomy_mapping_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "rip_taxonomy_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_keyword_taxonomy_mapping" ADD CONSTRAINT "rip_keyword_taxonomy_mapping_specialization_id_fkey" FOREIGN KEY ("specialization_id") REFERENCES "rip_taxonomy_specialization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_researcher_topic_score" ADD CONSTRAINT "rip_researcher_topic_score_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_researcher_topic_score" ADD CONSTRAINT "rip_researcher_topic_score_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_researcher_topic_score" ADD CONSTRAINT "rip_researcher_topic_score_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "rip_taxonomy_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_researcher_expertise_profile" ADD CONSTRAINT "rip_researcher_expertise_profile_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_researcher_expertise_profile" ADD CONSTRAINT "rip_researcher_expertise_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_ai_cache" ADD CONSTRAINT "rip_ai_cache_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_chat_session" ADD CONSTRAINT "rip_chat_session_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_chat_session" ADD CONSTRAINT "rip_chat_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_chat_message" ADD CONSTRAINT "rip_chat_message_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_chat_message" ADD CONSTRAINT "rip_chat_message_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "rip_chat_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_pipeline_run" ADD CONSTRAINT "rip_pipeline_run_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_module" ADD CONSTRAINT "university_module_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_user_access" ADD CONSTRAINT "rip_user_access_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rip_user_access" ADD CONSTRAINT "rip_user_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

