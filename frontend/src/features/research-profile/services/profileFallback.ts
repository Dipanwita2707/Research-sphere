import type { User } from '@/shared/services/auth.service';
import type { ProfileData } from '@/shared/types/research-profile.types';
import type { ResearchProfileIdentity } from '@/features/research-profile/services/researchProfile.service';

function resolveDisplayName(user: User): string {
  return (
    user.employee?.displayName ||
    user.student?.displayName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username ||
    'Researcher'
  );
}

function resolveDepartment(user: User): string {
  return user.employeeDetails?.department?.name || 'Department not available';
}

function resolveSchool(user: User, universityName: string): string {
  return user.employeeDetails?.department?.school?.name || universityName;
}

function resolveDesignation(user: User): string {
  return user.employeeDetails?.designation?.name || user.employee?.designation || 'Faculty';
}

/**
 * @param universityName Canonical university name (from the affiliation
 * engine, via `useAffiliation()`) used as the fallback "school" label when
 * the user has no department/school on record. Defaults to a generic
 * "University" if not supplied, instead of a hardcoded institution name.
 */
export function buildProfileDataFromAuthUser(user: User, universityName = 'University'): ProfileData {
  const name = resolveDisplayName(user);

  return {
    user: {
      uid: user.id,
      name,
      email: user.employeeDetails?.email || user.email || '',
      photo: user.profileImageUrl || null,
      designation: resolveDesignation(user),
      department: resolveDepartment(user),
      school: resolveSchool(user, universityName),
    },
    profile: {
      id: user.id,
      userId: user.id,
      bio: null,
      researchInterests: [],
      googleScholarId: null,
      scopusAuthorId: null,
      webOfScienceId: null,
      orcid: null,
      personalWebsite: null,
      lastSyncedAt: null,
      syncStatus: 'never_synced',
      syncError: null,
      autoSyncEnabled: false,
      filterSgtOnly: false,
      syncFrequencyDays: 30,
      visibility: {
        profile: 'public',
        showEmail: true,
        showPhone: false,
        showPublications: true,
        showMetrics: true,
        showCoAuthors: true,
        showResearchInterests: true,
      },
      metrics: {
        totalCitations: 0,
        hIndex: 0,
        i10Index: 0,
        avgCitationsPerPaper: 0,
        citationsPerYear: [],
      },
      profileCompleteness: 35,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    publications: [],
    coAuthors: [],
    impactMetrics: {
      avgCitationsPerPaper: 0,
      medianCitations: 0,
      highlyCitedPapers: 0,
      citationDistribution: [
        { range: '0-5', count: 0 },
        { range: '6-10', count: 0 },
        { range: '11-20', count: 0 },
        { range: '21+', count: 0 },
      ],
    },
  };
}

export function applyResearchIdentity(
  profileData: ProfileData,
  identity: Partial<ResearchProfileIdentity>
): ProfileData {
  return {
    ...profileData,
    profile: {
      ...profileData.profile,
      orcid: identity.orcid ?? profileData.profile.orcid,
      scopusAuthorId: identity.scopusAuthorId ?? profileData.profile.scopusAuthorId,
      webOfScienceId: identity.webOfScienceId ?? profileData.profile.webOfScienceId,
      lastSyncedAt: identity.lastSyncedAt ?? profileData.profile.lastSyncedAt,
      syncStatus: (identity.syncStatus as ProfileData['profile']['syncStatus']) ?? profileData.profile.syncStatus,
      syncError: identity.syncError ?? profileData.profile.syncError,
      autoSyncEnabled: identity.autoSyncEnabled ?? profileData.profile.autoSyncEnabled,
      filterSgtOnly: identity.filterSgtOnly ?? profileData.profile.filterSgtOnly,
      syncFrequencyDays: identity.syncFrequencyDays ?? profileData.profile.syncFrequencyDays,
    },
  };
}
