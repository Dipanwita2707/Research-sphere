"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, AlertCircle, Crown, FileText } from "lucide-react";
import ClubCreationForm from "@/features/dsw/components/ClubCreationForm";
import { dswAPI, notingAPI } from "@/features/dsw/services/api";
import { useToast } from "@/shared/ui-components/Toast";
import { useClubFormStore } from "@/features/dsw/stores/useClubFormStore";
import { useMyClubs, useMyClubRequests } from "@/features/dsw/hooks";
import { useAuthStore } from "@/shared/auth/authStore";
import {
  clubFormSchema,
  sanitizeClubFormData,
} from "@/features/dsw/validation/club.validation";

export default function CreateClubPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directChairpersonId, setDirectChairpersonId] = useState("");
  const toast = useToast();
  const resetForm = useClubFormStore((state) => state.reset);
  const currentStep = useClubFormStore((state) => state.currentStep);

  const { user: currentUser } = useAuthStore();
  const normalizedRole = String(
    (currentUser as any)?.userType || (currentUser as any)?.role || "",
  ).toLowerCase();
  const isAdmin = normalizedRole === "admin" || normalizedRole === "superadmin";
  const isStudentUser = normalizedRole === "student";
  const { data: myClubsData } = useMyClubs();
  const { data: myClubRequests } = useMyClubRequests();

  // Check if this student is already chairperson of any non-archived club
  const existingChairClub = (myClubsData?.data ?? []).find(
    (c) => c.chairpersonId ===
   currentUser?.id && c.status !== "archived",
  );
  const isAlreadyChairperson = isStudentUser && !!existingChairClub;
  const activeRequest = (myClubRequests ?? []).find(
    (r) => r.status === "pending" || r.status === "draft",
  );
  const hasActiveRequest = isStudentUser && !!activeRequest;
  const isLastStep = currentStep === 3;

  const handleSubmit = async () => {
    if (!isLastStep) {
      setError(
        "Please complete all steps first. Submit button becomes active only on Step 3 (Declarations).",
      );
      return;
    }

    const clubData = sanitizeClubFormData(useClubFormStore.getState().data);
    const validation = clubFormSchema.safeParse(clubData);
    if (!validation.success) {
      const FIELD_LABELS: Record<string, string> = {
        clubName: "Club Name",
        clubCategoryId: "Club Category",
        purpose: "Purpose",
        academicSession: "Academic Session",
        facultyFacilitatorId: "Faculty Facilitator",
        initialMembers: "Initial Members",
        targetStudentGroup: "Target Student Group",
        expectedActivityTypes: "Expected Activity Types",
        codeOfConductAccepted: "Code of Conduct",
        antiDiscriminationAccepted: "Anti-Discrimination Declaration",
        meetingFrequency: "Meeting Frequency",
        estimatedAnnualActivityCount: "Estimated Annual Activities",
      };

      const messages = Array.from(
        new Set(
          validation.error.issues.map((issue) => {
            const expected = (issue as { expected?: string }).expected;
            const rawMessage = String(issue.message || "").toLowerCase();
            if (
              issue.code === "invalid_type" &&
              (rawMessage.includes("received undefined") ||
                expected === "string" ||
                expected === "number")
            ) {
              const key = String(issue.path?.[0] ?? "field");
              return `${FIELD_LABELS[key] ?? key} is required`;
            }
            if (issue.code === "invalid_type" && expected === "array") {
              const key = String(issue.path?.[0] ?? "field");
              return `${FIELD_LABELS[key] ?? key}: please select at least one option`;
            }
            return issue.message;
          }),
        ),
      );
      setError(`Please complete all required fields:\n${messages.join("\n")}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Hard block — student can only chair one club at a time
    if (!isAdmin && isAlreadyChairperson) {
      setError(`You are already the chairperson of "${existingChairClub?.name}". A student can only be chairperson of one club at a time.`);
      setIsSubmitting(false);
      return;
    }

    // Hard block — only one active club request at a time
    if (!isAdmin && hasActiveRequest) {
      setError(
        `You already have an active club request (${activeRequest?.notingId}). Please wait for it to be resolved before submitting a new request.`,
      );
      setIsSubmitting(false);
      return;
    }

    try {
      // Submit club data directly - backend will create noting
      const clubPayload = {
        name: validation.data.clubName,
        categoryId: validation.data.clubCategoryId,
        purpose: validation.data.purpose,
        academicSession: validation.data.academicSession,
        facultyFacilitatorId: validation.data.facultyFacilitatorId,
        chairpersonId: directChairpersonId.trim(),
        initialMembers: validation.data.initialMembers,
        targetStudentGroup: validation.data.targetStudentGroup,
        expectedActivityTypes: validation.data.expectedActivityTypes,
        codeOfConductAccepted: validation.data.codeOfConductAccepted,
        antiDiscriminationAccepted: validation.data.antiDiscriminationAccepted,
        meetingFrequency: validation.data.meetingFrequency,
        estimatedAnnualActivityCount:
          validation.data.estimatedAnnualActivityCount,
        proposedEmail: validation.data.proposedEmail || undefined,
        socialMediaHandles: validation.data.socialMediaHandles,
        expectedStudentStrength: validation.data.expectedStudentStrength,
      };

      if (isAdmin && !directChairpersonId.trim()) {
        setError("Chairperson (student ID / UID / email) is required for direct creation.");
        setIsSubmitting(false);
        return;
      }

      const result = isAdmin
        ? await dswAPI.clubs.createClubDirect(clubPayload as any)
        : await notingAPI.createClub(clubPayload as any);

      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to submit club creation request");
      }

      // Clear the persisted draft so a future visit starts fresh
      resetForm();

      // Show success toast
      if (isAdmin) {
        toast.success("Club created directly and activated.", "✅ Club Created");
        router.push(`/dsw/clubs/${(result.data as any).id}`);
      } else {
        toast.success(
          `Club creation request submitted! Noting ID: ${(result.data as any).noting.notingId}`,
          "✅ Request Submitted Successfully",
        );

        const params = new URLSearchParams({
          submitted: "true",
          notingId: (result.data as any).noting.notingId,
          clubName: (result.data as any).noting.clubName ?? "",
        });
        router.push(`/dsw/clubs?${params.toString()}`);
      }
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
            {isAdmin ? "Create Club (Direct Activation)" : "Create New Student Club"}
          </h1>
          <p className="text-ev-600 mt-2">
            {isAdmin
              ? "As admin, this form creates the club immediately without the noting approval workflow."
              : "Complete the 3-step club creation form. Your request will go through the approval workflow: "}
            {!isAdmin && <strong>HOD → Dean → DSW → Higher Authority</strong>}
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
        ) : hasActiveRequest ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-blue-200 dark:border-blue-700 shadow-sm overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-5 flex items-start gap-4 border-b border-blue-200 dark:border-blue-700">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-blue-900 dark:text-blue-200">
                  Active Club Request Found
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  You can submit only one active club request at a time.
                </p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-ev-700">
                Your existing request is currently in progress:
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-900 dark:text-blue-200 font-semibold">
                  {activeRequest?.clubName || "Club Request"}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  Noting ID: {activeRequest?.notingId} · Status: {activeRequest?.status}
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => router.push("/dsw/my-clubs")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  View My Requests
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

            {isAdmin && (
              <div className="mt-4 ev-card p-5">
                <label className="block text-sm font-semibold text-ev-900 mb-2">
                  Chairperson (Student ID / UID / Email)
                </label>
                <input
                  type="text"
                  value={directChairpersonId}
                  onChange={(e) => setDirectChairpersonId(e.target.value)}
                  placeholder="e.g. student ID, UID, or student email"
                  className="ev-input"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-ev-400 mt-2">
                  Admin direct-create requires a valid student chairperson.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-6 ev-card p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-ev-900">
                    {isAdmin ? "Create Club Directly" : "Submit Club Creation Request"}
                  </h3>
                  <p className="text-sm text-ev-600 mt-1">
                    {isAdmin
                      ? "Creates an active club immediately and skips approval routing."
                      : "Creates a noting that will be routed: HOD → Dean → DSW → Higher Authority"}
                  </p>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !isLastStep}
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
                      {isAdmin ? "Create Club" : "Submit Request"}
                    </>
                  )}
                </button>
              </div>

              {!isLastStep && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  Complete Step {currentStep} and move to Step 3 to enable submission.
                </p>
              )}

              {!isAdmin && (
                <div className="mt-4 bg-ev-50 border border-[#b3cde0] rounded-lg p-4">
                  <p className="text-sm text-ev-800">
                    <strong>📋 Approval Workflow:</strong> Your request will be
                    sent to your HOD, then Dean, then DSW Team, and finally
                    Higher Authority for approval. You can track the progress in
                    the Noting System. Once all approvals are received, your club
                    will be automatically created with &quot;Active&quot; status.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
