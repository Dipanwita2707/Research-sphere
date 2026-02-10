'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';
import ClubCreationForm from '@/features/dsw/components/ClubCreationForm';
import { notingAPI } from '@/features/dsw/services/api';

interface ClubFormData {
  clubName: string;
  clubCategoryId: string;
  purpose: string;
  academicSession: string;
  facultyFacilitatorId: string;
  viceChairpersonId: string;
  initialMembers: string[];
  targetStudentGroup: 'all' | 'ug' | 'pg' | 'phd';
  expectedActivityTypes: string[];
  codeOfConductAccepted: boolean;
  antiDiscriminationAccepted: boolean;
  meetingFrequency: 'weekly' | 'monthly' | 'event_based';
  estimatedAnnualActivityCount: number;
  infrastructureRequirements: string[];
  fundingRequired: boolean;
  estimatedFundingAmount: number | null;
  visibility: 'public' | 'restricted';
  allowInternalCollaboration: boolean;
  allowExternalCollaboration: boolean;
  proposedEmail: string;
  socialMediaHandles: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  expectedStudentStrength: number | null;
}

export default function CreateClubPage() {
  const router = useRouter();
  const [clubData, setClubData] = useState<Partial<ClubFormData>>({
    socialMediaHandles: {},
    allowInternalCollaboration: true,
    allowExternalCollaboration: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAllSteps = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Step 1 validation
    if (!clubData.clubName) errors.push('Club name is required');
    if (!clubData.clubCategoryId) errors.push('Club category is required');
    if (!clubData.purpose || clubData.purpose.length < 50)
      errors.push('Purpose must be at least 50 characters');
    if (!clubData.academicSession) errors.push('Academic session is required');

    // Step 2 validation
    if (!clubData.viceChairpersonId) errors.push('Vice Chairperson is required');
    if (!clubData.initialMembers || clubData.initialMembers.length === 0)
      errors.push('At least one initial member is required');

    // Step 3 validation (Critical)
    if (!clubData.targetStudentGroup) errors.push('Target student group is required');
    if (!clubData.expectedActivityTypes || clubData.expectedActivityTypes.length === 0)
      errors.push('At least one activity type is required');
    if (!clubData.codeOfConductAccepted)
      errors.push('Code of Conduct must be accepted');
    if (!clubData.antiDiscriminationAccepted)
      errors.push('Anti-Discrimination declaration must be accepted');

    // Step 4 validation
    if (!clubData.meetingFrequency) errors.push('Meeting frequency is required');
    if (
      !clubData.estimatedAnnualActivityCount ||
      clubData.estimatedAnnualActivityCount < 1
    )
      errors.push('Annual activity count must be at least 1');
    if (
      !clubData.infrastructureRequirements ||
      clubData.infrastructureRequirements.length === 0
    )
      errors.push('Infrastructure requirements must be specified');
    if (clubData.fundingRequired && !clubData.estimatedFundingAmount)
      errors.push('Funding amount is required when funding is requested');
    if (
      clubData.fundingRequired &&
      clubData.estimatedFundingAmount &&
      clubData.estimatedFundingAmount >= 10000000000
    )
      errors.push('Funding amount cannot exceed ₹9,999,999,999.99');

    // Step 5 validation
    if (!clubData.visibility) errors.push('Visibility setting is required');

    // Step 6 is optional - no validation

    return { valid: errors.length === 0, errors };
  };

  const handleSubmit = async () => {
    // Final validation
    const validation = validateAllSteps();
    if (!validation.valid) {
      setError(`Please complete all required fields:\n${validation.errors.join('\n')}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Submit club data directly - backend will create noting
      const clubPayload = {
        name: clubData.clubName,
        categoryId: clubData.clubCategoryId,
        purpose: clubData.purpose,
        academicSession: clubData.academicSession,
        viceChairpersonId: clubData.viceChairpersonId,
        initialMembers: clubData.initialMembers,
        targetStudentGroup: clubData.targetStudentGroup,
        expectedActivityTypes: clubData.expectedActivityTypes,
        codeOfConductAccepted: clubData.codeOfConductAccepted,
        antiDiscriminationAccepted: clubData.antiDiscriminationAccepted,
        meetingFrequency: clubData.meetingFrequency,
        estimatedAnnualActivityCount: clubData.estimatedAnnualActivityCount,
        infrastructureRequirements: clubData.infrastructureRequirements,
        fundingRequired: clubData.fundingRequired,
        estimatedFundingAmount: clubData.estimatedFundingAmount,
        visibility: clubData.visibility,
        allowInternalCollaboration: clubData.allowInternalCollaboration,
        allowExternalCollaboration: clubData.allowExternalCollaboration,
        proposedEmail: clubData.proposedEmail,
        socialMediaHandles: clubData.socialMediaHandles,
        expectedStudentStrength: clubData.expectedStudentStrength,
      };

      // Use the notingAPI which includes auth token automatically
      const result = await notingAPI.createClub(clubPayload as any);

      if (!result.success) {
        throw new Error(result.message || 'Failed to submit club creation request');
      }

      // Show success message and redirect to noting details
      alert(
        `✅ Club Creation Noting Submitted Successfully!\n\n` +
        `Noting ID: ${result.data.noting.notingId}\n` +
        `Club Name: ${result.data.noting.clubName}\n\n` +
        `Approval Workflow:\n` +
        `1. Your HOD (Head of Department)\n` +
        `2. Your Dean (Dean of School/Faculty)\n` +
        `3. DSW Team (Dean of Students' Welfare)\n` +
        `4. Higher Authority\n\n` +
        `You will be redirected to track your noting status.`
      );

      // Redirect to noting details page
      router.push(`/noting/${result.data.noting.id}`);
    } catch (err: any) {
      console.error('Error submitting club creation:', err);
      setError(err.message || 'Failed to submit club creation request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to DSW Dashboard
          </button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create New Student Club
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Complete the 6-step club creation form. Your request will go through the approval
            workflow: <strong>HOD → Dean → DSW → Higher Authority</strong>
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-200">
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
        <ClubCreationForm
          value={clubData}
          onChangeAction={setClubData}
          disabled={isSubmitting}
        />

        {/* Submit Button */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Submit Club Creation Request
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Creates a noting that will be routed: HOD → Dean → DSW → Higher Authority
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>📋 Approval Workflow:</strong> Your request will be sent to your HOD, then
              Dean, then DSW Team, and finally Higher Authority for approval. You can track the
              progress in the Noting System. Once all approvals are received, your club will be
              automatically created with &quot;Active&quot; status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
