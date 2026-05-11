'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings } from 'lucide-react';
import ProfileManagement from '@/features/research-profile/components/ProfileManagement';
import type { ProfileData } from '@/shared/types/research-profile.types';
import { useAuthStore } from '@/shared/auth/authStore';
import { mockResearchProfileAPI } from '@/mocks/research-profile-api';
import { drdAnalyticsService } from '@/features/ipr-management/services/drdAnalytics.service';
import { mapDrdAnalyticsToProfileData } from '@/features/research-profile/services/profileDataMapper';
import { researchProfileService } from '@/features/research-profile/services/researchProfile.service';
import { applyResearchIdentity, buildProfileDataFromAuthUser } from '@/features/research-profile/services/profileFallback';
import logger from '@/shared/utils/logger';
import { useStaffDashboardSummary } from '@/shared/hooks/useUserContextQueries';

export default function ProfileManagePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  const { user } = useAuthStore();
  const { data: staffDashboardData } = useStaffDashboardSummary({ enabled: !!user });
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isOwner = user?.id === userId;
  const hasApplicantAnalyticsAccess =
    user?.userType === 'admin' ||
    !!staffDashboardData?.permissions?.some((dept) =>
      (dept.permissions || []).some((permission) => {
        const normalized = permission.toLowerCase();
        return (
          normalized.includes('applicant_analytics') ||
          normalized.includes('research_applicant_analytics') ||
          normalized.includes('book_applicant_analytics') ||
          normalized.includes('conference_applicant_analytics') ||
          normalized.includes('grant_applicant_analytics') ||
          normalized.includes('ipr_applicant_analytics')
        );
      })
    );

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId, isOwner, user, hasApplicantAnalyticsAccess]);

  const fetchProfile = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Only hit DRD analytics when the viewer actually has applicant analytics access.
      if (hasApplicantAnalyticsAccess) {
        try {
          const [analyticsResponse, submissionsResponse] = await Promise.all([
            drdAnalyticsService.getApplicantPersonAnalytics(userId),
            drdAnalyticsService.getApplicantPersonSubmissions(userId).catch(() => null), // Optional
          ]);
          
          if (analyticsResponse.data) {
            let mappedProfile = mapDrdAnalyticsToProfileData(
              userId,
              analyticsResponse.data,
              submissionsResponse?.data || undefined
            );
            try {
              const identity = await researchProfileService.getIdentity(userId);
              mappedProfile = applyResearchIdentity(mappedProfile, identity);
            } catch (identityError) {
              logger.warn('Failed to fetch profile identity data:', identityError);
            }
            setProfileData(mappedProfile);
            mockResearchProfileAPI.seedProfile(mappedProfile);
            return;
          }
        } catch (drdError) {
          logger.warn('Failed to fetch DRD analytics data for profile management:', drdError);
        }
      }

      if (isOwner && user) {
        let fallbackProfile = buildProfileDataFromAuthUser(user);
        try {
          const identity = await researchProfileService.getIdentity(userId);
          fallbackProfile = applyResearchIdentity(fallbackProfile, identity);
        } catch (identityError) {
          logger.warn('Failed to fetch profile identity data for fallback profile:', identityError);
        }
        setProfileData(fallbackProfile);
        mockResearchProfileAPI.seedProfile(fallbackProfile);
        return;
      }

      setError('Profile data is not available yet');
    } catch (err) {
      logger.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updatedProfile: ProfileData) => {
    setProfileData(updatedProfile);
  };

  if (loading) {
    return <ProfileManageSkeleton />;
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error || 'Profile not found'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The profile management page could not be loaded.
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-yellow-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You can only manage your own profile settings.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/research/profile/${userId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Profile
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/research/profile/${userId}`)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3">
              {profileData.user.photo ? (
                <img
                  src={profileData.user.photo}
                  alt={profileData.user.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-lg font-semibold text-white">
                    {profileData.user.name.charAt(0)}
                  </span>
                </div>
              )}
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Manage Profile
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {profileData.user.name} • {profileData.user.department}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProfileManagement
          profileData={profileData}
          onProfileUpdate={handleProfileUpdate}
          onProfileRefresh={fetchProfile}
          isOwner={isOwner}
          currentUserId={userId}
        />
      </div>
    </div>
  );
}

// Loading Skeleton Component
function ProfileManageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
