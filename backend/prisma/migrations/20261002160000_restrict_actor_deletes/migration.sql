-- DropForeignKey
ALTER TABLE "book_chapter_incentive_policy" DROP CONSTRAINT "book_chapter_incentive_policy_created_by_fkey";

-- DropForeignKey
ALTER TABLE "book_incentive_policy" DROP CONSTRAINT "book_incentive_policy_created_by_fkey";

-- DropForeignKey
ALTER TABLE "conference_incentive_policy" DROP CONSTRAINT "conference_incentive_policy_created_by_fkey";

-- DropForeignKey
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_user_id_fkey";

-- DropForeignKey
ALTER TABLE "document_change" DROP CONSTRAINT "document_change_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "grant_application_edit_suggestion" DROP CONSTRAINT "grant_application_edit_suggestion_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "grant_application_review" DROP CONSTRAINT "grant_application_review_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "grant_application_status_history" DROP CONSTRAINT "grant_application_status_history_changed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "grant_incentive_policy" DROP CONSTRAINT "grant_incentive_policy_created_by_fkey";

-- DropForeignKey
ALTER TABLE "incentive_policy" DROP CONSTRAINT "incentive_policy_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr" DROP CONSTRAINT "ipr_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_collaborative_session" DROP CONSTRAINT "ipr_collaborative_session_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_edit_suggestion" DROP CONSTRAINT "ipr_edit_suggestion_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_finance" DROP CONSTRAINT "ipr_finance_finance_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_review" DROP CONSTRAINT "ipr_review_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_status_history" DROP CONSTRAINT "ipr_status_history_changed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "ipr_status_update" DROP CONSTRAINT "ipr_status_update_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "research_contribution_edit_suggestion" DROP CONSTRAINT "research_contribution_edit_suggestion_reviewer_fkey";

-- DropForeignKey
ALTER TABLE "research_contribution_review" DROP CONSTRAINT "research_contribution_review_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "research_contribution_status_history" DROP CONSTRAINT "research_contribution_status_history_changed_by_fkey";

-- DropForeignKey
ALTER TABLE "research_incentive_policy" DROP CONSTRAINT "research_incentive_policy_created_by_fkey";

-- DropForeignKey
ALTER TABLE "research_progress_tracker" DROP CONSTRAINT "research_progress_tracker_user_id_fkey";

-- AddForeignKey
ALTER TABLE "ipr_review" ADD CONSTRAINT "ipr_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_edit_suggestion" ADD CONSTRAINT "ipr_edit_suggestion_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_collaborative_session" ADD CONSTRAINT "ipr_collaborative_session_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_history" ADD CONSTRAINT "ipr_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_finance" ADD CONSTRAINT "ipr_finance_finance_reviewer_id_fkey" FOREIGN KEY ("finance_reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_status_update" ADD CONSTRAINT "ipr_status_update_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_policy" ADD CONSTRAINT "incentive_policy_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr" ADD CONSTRAINT "ipr_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_change" ADD CONSTRAINT "document_change_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_review" ADD CONSTRAINT "research_contribution_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_status_history" ADD CONSTRAINT "research_contribution_status_history_changed_by_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_contribution_edit_suggestion" ADD CONSTRAINT "research_contribution_edit_suggestion_reviewer_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_incentive_policy" ADD CONSTRAINT "research_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_incentive_policy" ADD CONSTRAINT "book_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_chapter_incentive_policy" ADD CONSTRAINT "book_chapter_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_incentive_policy" ADD CONSTRAINT "conference_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_incentive_policy" ADD CONSTRAINT "grant_incentive_policy_created_by_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_progress_tracker" ADD CONSTRAINT "research_progress_tracker_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_review" ADD CONSTRAINT "grant_application_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_status_history" ADD CONSTRAINT "grant_application_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_application_edit_suggestion" ADD CONSTRAINT "grant_application_edit_suggestion_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
