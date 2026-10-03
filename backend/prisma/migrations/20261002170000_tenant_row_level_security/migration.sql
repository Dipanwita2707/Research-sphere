-- Row-Level Security: database-enforced tenant isolation (defence in depth behind the
-- Prisma tenant extension). Generated from schema.prisma — one policy per tenant-owned table.
--
-- How it is enforced:
--   * Policies read two settings: app.tenant_id (the university id) and app.rls_bypass ('on'
--     for platform work). Unset settings deny access (fail closed).
--   * Roles with BYPASSRLS (the Neon owner the app and migrations use today) are NOT affected,
--     so this migration does not change application behaviour.
--   * Any role WITHOUT BYPASSRLS (e.g. a read-only reporting/BI role) only sees rows of the
--     university it sets in app.tenant_id — direct database access is tenant-isolated.
--   * Moving the app itself onto a non-bypass role needs per-request scoping that survives
--     Prisma's query batching; see docs/AUDIT_2026-10-02.md ("Row-Level Security").

CREATE OR REPLACE FUNCTION app_rls_allows(row_tenant uuid, shared_null boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('app.rls_bypass', true), '') = 'on'
      OR row_tenant = nullif(current_setting('app.tenant_id', true), '')::uuid
      OR (shared_null AND row_tenant IS NULL)
$$;

-- ApiUsageDaily
ALTER TABLE "api_usage_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_usage_daily" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "api_usage_daily" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- AuditLog
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_log" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- AuditReportConfig
ALTER TABLE "audit_report_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_report_config" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_report_config" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- AuditReportHistory
ALTER TABLE "audit_report_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_report_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_report_history" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- BookChapterIncentivePolicy
ALTER TABLE "book_chapter_incentive_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "book_chapter_incentive_policy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "book_chapter_incentive_policy" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- BookIncentivePolicy
ALTER TABLE "book_incentive_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "book_incentive_policy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "book_incentive_policy" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- BugReportScreenshot
ALTER TABLE "bug_report_screenshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bug_report_screenshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bug_report_screenshots" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- BugReport
ALTER TABLE "bug_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bug_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bug_reports" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- Card
ALTER TABLE "card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "card" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- CentralDepartment
ALTER TABLE "central_department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_department" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "central_department" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- CentralDepartmentPermission
ALTER TABLE "central_department_permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "central_department_permission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "central_department_permission" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ChangeHistory
ALTER TABLE "changes_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "changes_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "changes_history" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ConferenceIncentivePolicy
ALTER TABLE "conference_incentive_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conference_incentive_policy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "conference_incentive_policy" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ConsentNotice (rows with NULL university are shared by all tenants)
ALTER TABLE "consent_notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_notices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "consent_notices" USING (app_rls_allows("university_id", true)) WITH CHECK (app_rls_allows("university_id", true));

-- ConsentRecord
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "consent_records" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- DataBreachIncident
ALTER TABLE "data_breach_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_breach_incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_breach_incidents" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- DataPrincipalNominee
ALTER TABLE "data_principal_nominees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_principal_nominees" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_principal_nominees" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- DataPrincipalRequest
ALTER TABLE "data_principal_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_principal_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_principal_requests" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- DataRetentionPolicy (rows with NULL university are shared by all tenants)
ALTER TABLE "data_retention_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_retention_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_retention_policies" USING (app_rls_allows("university_id", true)) WITH CHECK (app_rls_allows("university_id", true));

-- Department
ALTER TABLE "department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "department" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "department" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- DepartmentPermission
ALTER TABLE "department_permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "department_permission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "department_permission" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- DocumentChange
ALTER TABLE "document_change" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_change" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "document_change" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- EmployeeDetails
ALTER TABLE "employee_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_details" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employee_details" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- FacultySchoolList
ALTER TABLE "faculty_school_list" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_school_list" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "faculty_school_list" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- GrantApplication
ALTER TABLE "grant_application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_application" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_application" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- GrantApplicationEditSuggestion
ALTER TABLE "grant_application_edit_suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_application_edit_suggestion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_application_edit_suggestion" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- GrantApplicationReview
ALTER TABLE "grant_application_review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_application_review" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_application_review" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- GrantApplicationStatusHistory
ALTER TABLE "grant_application_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_application_status_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_application_status_history" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- GrantConsortiumOrganization
ALTER TABLE "grant_consortium_organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_consortium_organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_consortium_organization" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- GrantIncentivePolicy
ALTER TABLE "grant_incentive_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_incentive_policy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_incentive_policy" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- GrantInvestigator
ALTER TABLE "grant_investigator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grant_investigator" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grant_investigator" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IncentivePolicy
ALTER TABLE "incentive_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incentive_policy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "incentive_policy" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IPR
ALTER TABLE "ipr" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprApplicantDetails
ALTER TABLE "ipr_applicant_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_applicant_details" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_applicant_details" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprApplication
ALTER TABLE "ipr_application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_application" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_application" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprCollaborativeSession
ALTER TABLE "ipr_collaborative_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_collaborative_session" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_collaborative_session" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprContributor
ALTER TABLE "ipr_contributor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_contributor" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_contributor" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprEditSuggestion
ALTER TABLE "ipr_edit_suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_edit_suggestion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_edit_suggestion" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprFinance
ALTER TABLE "ipr_finance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_finance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_finance" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprReview
ALTER TABLE "ipr_review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_review" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_review" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprSdg
ALTER TABLE "ipr_sdg" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_sdg" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_sdg" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprStatusHistory
ALTER TABLE "ipr_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_status_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_status_history" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- IprStatusUpdate
ALTER TABLE "ipr_status_update" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ipr_status_update" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ipr_status_update" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- Notification
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- Program
ALTER TABLE "program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "program" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ProgramSpecialization
ALTER TABLE "program_specialization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_specialization" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "program_specialization" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- PublicationImport
ALTER TABLE "publication_import" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "publication_import" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "publication_import" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- PublicationImportRun
ALTER TABLE "publication_import_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "publication_import_run" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "publication_import_run" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ReissueRequest
ALTER TABLE "reissue_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reissue_request" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reissue_request" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ReportingStructure
ALTER TABLE "reporting_structure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reporting_structure" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reporting_structure" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchContribution
ALTER TABLE "research_contribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_contribution" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_contribution" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchContributionApplicantDetails
ALTER TABLE "research_contribution_applicant_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_contribution_applicant_details" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_contribution_applicant_details" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchContributionAuthor
ALTER TABLE "research_contribution_author" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_contribution_author" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_contribution_author" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchContributionEditSuggestion
ALTER TABLE "research_contribution_edit_suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_contribution_edit_suggestion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_contribution_edit_suggestion" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchContributionReview
ALTER TABLE "research_contribution_review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_contribution_review" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_contribution_review" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchContributionStatusHistory
ALTER TABLE "research_contribution_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_contribution_status_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_contribution_status_history" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchIncentivePolicy
ALTER TABLE "research_incentive_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_incentive_policy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_incentive_policy" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchProfileIdentity
ALTER TABLE "research_profile_identity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_profile_identity" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_profile_identity" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchProgressStatusHistory
ALTER TABLE "research_progress_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_progress_status_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_progress_status_history" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- ResearchProgressTracker
ALTER TABLE "research_progress_tracker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_progress_tracker" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "research_progress_tracker" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipAiCache
ALTER TABLE "rip_ai_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_ai_cache" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_ai_cache" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipChatMessage
ALTER TABLE "rip_chat_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_chat_message" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_chat_message" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipChatSession
ALTER TABLE "rip_chat_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_chat_session" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_chat_session" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipContributionKeyword
ALTER TABLE "rip_contribution_keyword" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_contribution_keyword" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_contribution_keyword" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipKeywordTaxonomyMapping
ALTER TABLE "rip_keyword_taxonomy_mapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_keyword_taxonomy_mapping" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_keyword_taxonomy_mapping" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipPipelineRun
ALTER TABLE "rip_pipeline_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_pipeline_run" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_pipeline_run" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipResearchKeyword
ALTER TABLE "rip_research_keyword" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_research_keyword" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_research_keyword" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipResearcherExpertiseProfile
ALTER TABLE "rip_researcher_expertise_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_researcher_expertise_profile" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_researcher_expertise_profile" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipResearcherTopicScore
ALTER TABLE "rip_researcher_topic_score" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_researcher_topic_score" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_researcher_topic_score" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipTaxonomyCategory
ALTER TABLE "rip_taxonomy_category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_taxonomy_category" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_taxonomy_category" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipTaxonomyDomain
ALTER TABLE "rip_taxonomy_domain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_taxonomy_domain" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_taxonomy_domain" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipTaxonomySpecialization
ALTER TABLE "rip_taxonomy_specialization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_taxonomy_specialization" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_taxonomy_specialization" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- RipUserAccess
ALTER TABLE "rip_user_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rip_user_access" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rip_user_access" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- Role (rows with NULL university are shared by all tenants)
ALTER TABLE "role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "role" USING (app_rls_allows("university_id", true)) WITH CHECK (app_rls_allows("university_id", true));

-- Section
ALTER TABLE "section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "section" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "section" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- StudentDetails
ALTER TABLE "student_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_details" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_details" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- UniversityModule
ALTER TABLE "university_module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "university_module" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "university_module" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- UniversitySubscription
ALTER TABLE "university_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "university_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "university_subscriptions" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- UserDepartmentPermission
ALTER TABLE "user_department_permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_department_permission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_department_permission" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));

-- UserLogin
ALTER TABLE "user_login" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_login" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_login" USING (app_rls_allows("university_id")) WITH CHECK (app_rls_allows("university_id"));
