-- Add Conference Sub-Type and Additional Fields

-- Conference Sub-Type: paper_in_conference_not_indexed, paper_in_conference_indexed_scopus, keynote_speaker_invited_talks, organizer_coordinator_member
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "conference_sub_type" VARCHAR(64);

-- Conference Paper in Proceedings Indexed in Scopus specific fields
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "proceedings_quartile" VARCHAR(16); -- NA, Q1, Q2, Q3, Q4
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "total_presenters" INTEGER DEFAULT 1;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "is_presenter" BOOLEAN DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "virtual_conference" BOOLEAN DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "full_paper" BOOLEAN DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "conference_held_at_sgt" BOOLEAN DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "conference_best_paper_award" BOOLEAN DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "industry_collaboration" BOOLEAN DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "central_facility_used" BOOLEAN DEFAULT false;
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "issn_isbn_issue_no" VARCHAR(64);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "paper_doi" VARCHAR(256);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "weblink" VARCHAR(512);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "priority_funding_area" VARCHAR(256);

-- Keynote Speaker/Session Chair/Invited Talks specific fields
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "conference_role" VARCHAR(64); -- keynote_speaker, session_chair, invited_speaker, invited_panel_member
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "indexed_in" VARCHAR(32); -- wos, scopus, both, non_index
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "conference_held_location" VARCHAR(32); -- india, abroad
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "venue" VARCHAR(512);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "topic" VARCHAR(512);
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "attended_virtual" BOOLEAN DEFAULT false;

-- Organizer/Coordinator/Member of Conference held at SGT specific fields
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "event_category" VARCHAR(32); -- conference, seminar_symposia
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "organizer_role" VARCHAR(64); -- For different roles based on category
-- Conference roles: chairman_chairperson, joint_secretary, committee_coordinators, committee_members, session_chair
-- Seminar/Symposia roles: seminar_organizing_secretary, seminar_joint_organizing_secretary, seminar_committee_coordinator, seminar_committee_member
ALTER TABLE "research_contribution" ADD COLUMN IF NOT EXISTS "conference_type" VARCHAR(32); -- national, international

-- Add index for conference_sub_type
CREATE INDEX IF NOT EXISTS "research_contribution_conference_sub_type_idx" ON "research_contribution"("conference_sub_type");
