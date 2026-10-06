'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Eye, Settings } from 'lucide-react';
import ProfileManagement from '@/features/research-profile/components/ProfileManagement';
import type { ProfileData } from '@/shared/types/research-profile.types';
import { useAuthStore } from '@/shared/auth/authStore';
import { researchProfileService, viewToProfileData } from '@/features/research-profile/services/researchProfile.service';
import { applyResearchIdentity } from '@/features/research-profile/services/profileFallback';
import logger from '@/shared/utils/logger';

export default function ProfileManagePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  const { user } = useAuthStore();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = user?.id === userId;
  const canEditResearchIdentityIds =
    user?.userType === 'admin' ||
    user?.role?.name === 'superadmin' ||
    user?.role?.name === 'admin';

  useEffect(() => {
    if (userId && isOwner) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [userId, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const view = await researchProfileService.getProfileView(userId);
      let profile = viewToProfileData(view);
      try {
        // Sync settings (ORCID/Scopus IDs, schedule) live on the identity record.
        profile = applyResearchIdentity(profile, await researchProfileService.getIdentity(userId));
      } catch (identityError) {
        logger.warn('Failed to fetch profile identity data:', identityError);
      }
      setProfileData(profile);
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

  if (!isOwner) {
    return <ManageAccessRestricted userId={userId} onBack={() => router.back()} onView={() => router.push(`/research/profile/${userId}`)} />;
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-blush dark:bg-gray-900 flex items-center justify-center">
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
            className="px-4 py-2 bg-wine text-wine-fg rounded-lg hover:bg-wine-dark"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { user: person, profile } = profileData;
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="min-h-screen bg-blush dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push(`/research/profile/${userId}`)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-muted transition-colors hover:bg-white/70 hover:text-wine dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </button>

        {/* Banner */}
        <header className="relative mb-6 overflow-hidden rounded-2xl border border-blush-line bg-gradient-to-r from-gold-50 via-blush-light to-blush-light px-5 py-6 sm:px-8 dark:border-gray-700 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {person.photo ? (
              <img
                src={person.photo}
                alt={person.name}
                className="h-20 w-20 shrink-0 rounded-full border-4 border-white object-cover ring-2 ring-gold dark:border-gray-700"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-wine-dark font-serif text-2xl font-bold text-white ring-2 ring-gold dark:border-gray-700">
                {initials || '?'}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-dark dark:text-gold">Profile settings</p>
              <h1 className="mt-1 truncate font-serif text-2xl font-bold text-ink sm:text-3xl dark:text-white">{person.name}</h1>
              <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">
                {[person.designation, person.department].filter(Boolean).join(' · ') || 'Researcher'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <IdChip label="ORCID" value={profile.orcid} />
                <IdChip label="Scopus" value={profile.scopusAuthorId} />
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blush-line bg-white px-2.5 py-1 text-xs font-semibold text-ink dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
                  <BookOpen className="h-3.5 w-3.5 text-gold" />
                  {profileData.publications.length} publication{profileData.publications.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <a
              href={`/research/profile/${userId}`}
              className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-blush-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-wine/40 hover:text-wine sm:self-center dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:text-gold"
            >
              <Eye className="h-4 w-4" />
              View profile
            </a>
          </div>
        </header>

        <ProfileManagement
          profileData={profileData}
          onProfileUpdate={handleProfileUpdate}
          onProfileRefresh={fetchProfile}
          isOwner={isOwner}
          currentUserId={userId}
          canEditResearchIdentityIds={canEditResearchIdentityIds}
        />
      </div>
    </div>
  );
}

function IdChip({ label, value }: { label: string; value?: string | null }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
        value
          ? 'border-blush-line bg-white text-ink dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200'
          : 'border-dashed border-blush-line bg-transparent text-ink-subtle dark:border-gray-600 dark:text-gray-500'
      }`}
      title={value ? `${label}: ${value}` : `${label} not linked`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
      {label}
      {value ? <span className="font-mono font-normal text-ink-muted dark:text-gray-400">{value}</span> : <span className="font-normal">not linked</span>}
    </span>
  );
}

function ManageAccessRestricted({ onBack, onView }: { userId: string; onBack: () => void; onView: () => void }) {
  return (
    <div className="min-h-screen bg-blush dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="w-8 h-8 text-yellow-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Restricted</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">You can only manage your own profile settings.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onView} className="px-4 py-2 bg-wine text-wine-fg rounded-lg hover:bg-wine-dark">View Profile</button>
          <button onClick={onBack} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Go Back</button>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton Component
function ProfileManageSkeleton() {
  const bar = 'rounded bg-blush-deep/60 animate-pulse dark:bg-gray-700';
  return (
    <div className="min-h-screen bg-blush dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className={`mb-4 h-6 w-32 ${bar}`} />
        <div className="mb-6 flex items-center gap-5 rounded-2xl border border-blush-line bg-blush-light px-8 py-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="h-20 w-20 rounded-full bg-blush-deep/60 animate-pulse dark:bg-gray-700" />
          <div className="space-y-2">
            <div className={`h-3 w-24 ${bar}`} />
            <div className={`h-7 w-64 ${bar}`} />
            <div className={`h-4 w-48 ${bar}`} />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="hidden space-y-2 lg:block">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-14 ${bar} rounded-xl`} />)}
          </div>
          <div className="space-y-4 rounded-2xl border border-blush-line bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className={`h-6 w-48 ${bar}`} />
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className={`h-16 ${bar} rounded-xl`} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
