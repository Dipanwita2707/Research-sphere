"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, AlertCircle, Crown } from "lucide-react";
import ClubCreationForm from "@/features/dsw/components/ClubCreationForm";
import { notingAPI } from "@/features/dsw/services/api";
import { useToast } from "@/shared/ui-components/Toast";
import { useClubFormStore } from "@/features/dsw/stores/useClubFormStore";
import { useMyClubs } from "@/features/dsw/hooks";
import { useAuthStore } from "@/shared/auth/authStore";

export default function CreateClubPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const resetForm = useClubFormStore((state) => state.reset);

  const { user: currentUser } = useAuthStore();
  const { data: myClubsData } = useMyClubs();

  // Check if this student is already chairperson of any non-archived club
  const existingChairClub = (myClubsData?.data ?? []).find(
    (c) => c.chairpersonId === currentUser?.id && c.status !== "archived",
  );
  const isAlreadyChairperson = !!existingChairClub;

  const validateAllSteps = (): { valid: boolean; errors: string[] } => {
    const clubData = useClubFormStore.getState().data;
    const errors: string[] = [];

    // Step 1 validation
    if (!clubData.clubName) errors.push("Club name is required");
    if (!clubData.clubCategoryId) errors.push("Club category is required");
    if (!clubData.purpose || clubData.purpose.length < 50)
      errors.push("Purpose must be at least 50 characters");
    if (!clubData.academicSession) errors.push("Academic session is required");

    // Step 2 validation
    if (!clubData.facultyFacilitatorId)
      errors.push("Faculty Facilitator is required");
    if (!clubData.initialMembers || clubData.initialMembers.length === 0)
      errors.push("At least one initial member is required");

    // Step 3 validation (Critical)
    if (
      !clubData.targetStudentGroup ||
      clubData.targetStudentGroup.length === 0
    )
      errors.push("At least one target student group is required");
    if (
      !clubData.expectedActivityTypes ||
      clubData.expectedActivityTypes.length === 0
    )
      errors.push("At least one activity type is required");
    if (!clubData.codeOfConductAccepted)
      errors.push("Code of Conduct must be accepted");
    if (!clubData.antiDiscriminationAccepted)
      errors.push("Anti-Discrimination declaration must be accepted");

    // Step 4 validation
    if (!clubData.meetingFrequency)
      errors.push("Meeting frequency is required");
    if (
      !clubData.estimatedAnnualActivityCount ||
      clubData.estimatedAnnualActivityCount < 1
    )
      errors.push("Annual activity count must be at least 1");

    // Step 5 is optional - no validation

    return { valid: errors.length === 0, errors };
  };

  const handleSubmit = async () => {
    // Final validation
    const validation = validateAllSteps();
    if (!validation.valid) {
      setError(
        `Please complete all required fields:\n${validation.errors.join("\n")}`,
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Hard block — student can only chair one club at a time
    if (isAlreadyChairperson) {
      setError(`You are already the chairperson of "${existingChairClub?.name}". A student can only be chairperson of one club at a time.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const clubData = useClubFormStore.getState().data;
      // Submit club data directly - backend will create noting
      const clubPayload = {
        name: clubData.clubName,
        categoryId: clubData.clubCategoryId,
        purpose: clubData.purpose,
        academicSession: clubData.academicSession,
        facultyFacilitatorId: clubData.facultyFacilitatorId,
        initialMembers: clubData.initialMembers,
        targetStudentGroup: clubData.targetStudentGroup,
        expectedActivityTypes: clubData.expectedActivityTypes,
        codeOfConductAccepted: clubData.codeOfConductAccepted,
        antiDiscriminationAccepted: clubData.antiDiscriminationAccepted,
        meetingFrequency: clubData.meetingFrequency,
        estimatedAnnualActivityCount: clubData.estimatedAnnualActivityCount,
        proposedEmail: clubData.proposedEmail,
        socialMediaHandles: clubData.socialMediaHandles,
        expectedStudentStrength: clubData.expectedStudentStrength,
      };

      // Use the notingAPI which includes auth token automatically
      const result = await notingAPI.createClub(clubPayload as any);

      if (!result.success || !result.data) {
        throw new Error(
          result.message || "Failed to submit club creation request",
        );
      }

      // Clear the persisted draft so a future visit starts fresh
      resetForm();

      // Show success toast
      toast.success(
        `Club creation request submitted! Noting ID: ${result.data.noting.notingId}`,
        "✅ Request Submitted Successfully",
      );

      // Redirect to clubs page with pending banner params
      const params = new URLSearchParams({
        submitted: "true",
        notingId: result.data.noting.notingId,
        clubName: result.data.noting.clubName ?? "",
      });
      router.push(`/dsw/clubs?${params.toString()}`);
    } catch (err: any) {
      console.error("Error submitting club creation:", err);
      setError(err.message || "Failed to submit club creation request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-ev-400 hover:text-ev-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to DSW Dashboard
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold text-ev-900">
            Create New Student Club
          </h1>
          <p className="text-ev-600 mt-2">
            Complete the 3-step club creation form. Your request will go through
            the approval workflow:{" "}
            <strong>HOD → Dean → DSW → Higher Authority</strong>
          </p>
        </div>

        {/* Blocked: already chairperson — show only this, no form */}
        {isAlreadyChairperson ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-amber-200 dark:border-amber-700 shadow-sm overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-5 flex items-start gap-4 border-b border-amber-200 dark:border-amber-700">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                  You are already a Chairperson
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  A student can only be the chairperson of{" "}
                  <strong>one club at a time</strong>.
                </p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-ev-700">
                You are currently the chairperson of{" "}
                <strong className="text-gray-900 dark:text-white">
                  &quot;{existingChairClub?.name}&quot;
                </strong>
                . You cannot create or lead another club until you step down
                from your current position.
              </p>
              <p className="text-sm text-ev-500">
                You can still join other clubs as a <strong>member</strong>.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => router.push(`/dsw/clubs/${existingChairClub?.id}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
                >
                  <Crown className="w-4 h-4" />
                  View My Club
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dsw/clubs")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold transition-colors"
                >
                  Browse All Clubs
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-800">
                      Submission Error
                    </h3>
                    <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-line mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Club Creation Form */}
            <ClubCreationForm disabled={isSubmitting} />

            {/* Submit Button */}
            <div className="mt-6 ev-card p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-ev-900">
                    Submit Club Creation Request
                  </h3>
                  <p className="text-sm text-ev-600 mt-1">
                    Creates a noting that will be routed: HOD → Dean → DSW →
                    Higher Authority
                  </p>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 ev-btn disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 bg-ev-50 border border-[#b3cde0] rounded-lg p-4">
                <p className="text-sm text-ev-800">
                  <strong>📋 Approval Workflow:</strong> Your request will be
                  sent to your HOD, then Dean, then DSW Team, and finally
                  Higher Authority for approval. You can track the progress in
                  the Noting System. Once all approvals are received, your club
                  will be automatically created with &quot;Active&quot; status.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
