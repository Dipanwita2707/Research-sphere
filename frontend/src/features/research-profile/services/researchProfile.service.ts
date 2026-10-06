import api, { unwrapResponse } from '@/shared/api/api';
import type { CoAuthor, ImpactMetrics, IncentiveSummary, ProfileData, ProfileVisibility, Publication } from '@/shared/types/research-profile.types';

export interface ResearchProfileIdentity {
  id: string | null;
  userId: string;
  orcid: string | null;
  scopusAuthorId: string | null;
  webOfScienceId?: string | null;
  affiliationAliases?: string[];
  autoSyncEnabled: boolean;
  filterSgtOnly: boolean;
  syncFrequencyDays: number;
  syncStatus: string;
  syncError: string | null;
  lastSyncedAt: string | null;
  importRuns?: PublicationImportRun[];
}

export interface PublicationImportRun {
  id: string;
  triggerType: string;
  sourceSystems: string[];
  status: string;
  discoveredCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  specialReviewCount: number;
  startedAt: string;
  finishedAt: string | null;
  errorSummary?: Array<{ title?: string; message: string }>;
}

export interface PublicationSyncResult {
  /** How many synced works are affiliated with this university (eligible for incentive), not, or unknown. */
  affiliation?: { affiliated: number; not_affiliated: number; unknown: number };
  runId: string;
  discoveredCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  specialReviewCount: number;
  errors: Array<{ title?: string; message: string }>;
  contributions: string[];
}

export interface ManualProfileImportPublication {
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  doi?: string | null;
  citationCount?: number;
  publicationType?: string;
}

/** Research CV sections the author fills in (the CV adds publications, grants, patents and metrics itself). */
export interface CvDetails {
  googleScholarUrl?: string;
  education?: Array<{ degree?: string; institution?: string; year?: string; thesis?: string }>;
  experience?: Array<{ role?: string; organization?: string; period?: string; details?: string }>;
  presentations?: string[];
  awards?: string[];
  teaching?: string[];
  skills?: string[];
  memberships?: string[];
  /** Printed only on the author's own CV. */
  references?: Array<{ name?: string; designation?: string; organization?: string; email?: string; phone?: string }>;
  /** Other viewers: references exist but are not shown. */
  hasReferences?: boolean;
}

/** The author's privacy + profile content settings (author/admin only). */
export interface AuthorProfileSettings {
  bio: string | null;
  researchInterests: string[];
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  showPhone: boolean;
  showResearchInterests: boolean;
  showPublications: boolean;
  showCoAuthors: boolean;
  showMetrics: boolean;
  showPhoto: boolean;
  allowSearchIndexing: boolean;
  publicHandle: string | null;
  cvDetails: CvDetails;
  /** e.g. /p/sgt-demo/dr-suresh-patel — set only while the profile is public. */
  publicPath: string | null;
}

export type AuthorProfileSettingsUpdate = Partial<Omit<AuthorProfileSettings, 'publicHandle' | 'publicPath'>>;

export interface AuthorProfileSections {
  photo: boolean;
  email: boolean;
  phone: boolean;
  researchInterests: boolean;
  publications: boolean;
  coAuthors: boolean;
  metrics: boolean;
}

/** Profile as the current viewer is allowed to see it; hidden sections arrive empty. */
export interface AuthorProfileView {
  user: {
    id: string;
    uid: string;
    name: string;
    email: string | null;
    phone: string | null;
    photo: string | null;
    designation: string | null;
    department: string | null;
    school: string | null;
    university: string | null;
  };
  profile: {
    id: string;
    userId: string;
    bio: string | null;
    researchInterests: string[];
    researchInterestsSource: 'author' | 'derived';
    orcid: string | null;
    scopusAuthorId: string | null;
    webOfScienceId: string | null;
    lastSyncedAt: string | null;
    metrics: ProfileData['profile']['metrics'];
  };
  publications: Publication[];
  publicationCount: number | null;
  /** Incentives earned across the listed works; null for everyone except the author and admins. */
  incentiveSummary: IncentiveSummary | null;
  coAuthors: CoAuthor[];
  /** Distinct co-authors across the listed works (the coAuthors list is capped at 100). */
  coAuthorCount: number | null;
  impactMetrics: ImpactMetrics | null;
  sections: AuthorProfileSections;
  access: { isOwner: boolean; canEdit: boolean; canViewPrivate: boolean };
  settings?: AuthorProfileSettings;
  visibility: ProfileVisibility;
  allowSearchIndexing: boolean;
  publicPath?: string | null;
}

/** Error codes the view endpoint uses when the viewer may not see a profile. */
export const PROFILE_ACCESS_CODES = ['PROFILE_PRIVATE', 'PROFILE_INSTITUTION_ONLY', 'PROFILE_NOT_FOUND'] as const;
export type ProfileAccessCode = (typeof PROFILE_ACCESS_CODES)[number];

export function profileAccessCodeOf(error: unknown): ProfileAccessCode | null {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return (PROFILE_ACCESS_CODES as readonly string[]).includes(code || '') ? (code as ProfileAccessCode) : null;
}

const EMPTY_IMPACT: ImpactMetrics = {
  avgCitationsPerPaper: 0,
  medianCitations: 0,
  highlyCitedPapers: 0,
  citationDistribution: [],
};

/** Adapt the view to the ProfileData shape the existing profile components render. */
export function viewToProfileData(view: AuthorProfileView): ProfileData {
  const s = view.settings;
  const now = new Date().toISOString();
  return {
    user: {
      uid: view.user.uid,
      name: view.user.name,
      email: view.user.email || '',
      photo: view.user.photo,
      designation: view.user.designation || '',
      department: view.user.department || '',
      school: view.user.school || '',
    },
    profile: {
      id: view.profile.id,
      userId: view.profile.userId,
      googleScholarId: null,
      scopusAuthorId: view.profile.scopusAuthorId,
      webOfScienceId: view.profile.webOfScienceId,
      orcid: view.profile.orcid,
      researchInterests: view.profile.researchInterests,
      bio: view.profile.bio,
      personalWebsite: null,
      metrics: view.profile.metrics,
      visibility: {
        profile: view.visibility,
        showEmail: s ? s.showEmail : view.sections.email,
        showPhone: s ? s.showPhone : view.sections.phone,
        showResearchInterests: s ? s.showResearchInterests : view.sections.researchInterests,
        showPublications: s ? s.showPublications : view.sections.publications,
        showCoAuthors: s ? s.showCoAuthors : view.sections.coAuthors,
        showMetrics: s ? s.showMetrics : view.sections.metrics,
      },
      lastSyncedAt: view.profile.lastSyncedAt,
      syncStatus: 'never_synced',
      syncError: null,
      autoSyncEnabled: false,
      filterSgtOnly: false,
      syncFrequencyDays: 1,
      profileCompleteness: 0,
      isVerified: true,
      verifiedAt: null,
      verifiedBy: null,
      createdAt: now,
      updatedAt: now,
    },
    publications: view.publications,
    coAuthors: view.coAuthors,
    impactMetrics: view.impactMetrics || EMPTY_IMPACT,
  };
}

class ResearchProfileService {
  /** Visibility-enforced profile for the signed-in viewer. Rejects with PROFILE_* codes when hidden. */
  async getProfileView(userId: string): Promise<AuthorProfileView> {
    const response = await api.get(`/research/profile/${userId}/view`);
    return unwrapResponse<AuthorProfileView>(response);
  }

  /** Download the researcher's CV (PDF). The server applies the same visibility rules as the profile. */
  async downloadCv(userId: string, fallbackName = 'Research-CV'): Promise<void> {
    const response = await api.get<Blob>(`/research/profile/${userId}/cv`, { responseType: 'blob' });
    const disposition = String(response.headers?.['content-disposition'] || '');
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || `${fallbackName}.pdf`;
    const url = URL.createObjectURL(response.data);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async getProfileSettings(userId: string): Promise<AuthorProfileSettings> {
    const response = await api.get(`/research/profile/${userId}/settings`);
    return unwrapResponse<AuthorProfileSettings>(response);
  }

  async updateProfileSettings(userId: string, update: AuthorProfileSettingsUpdate): Promise<AuthorProfileSettings> {
    const response = await api.put(`/research/profile/${userId}/settings`, update);
    return unwrapResponse<AuthorProfileSettings>(response);
  }

  async getIdentity(userId: string): Promise<ResearchProfileIdentity> {
    const response = await api.get(`/research/profile/${userId}/identity`);
    return unwrapResponse<ResearchProfileIdentity>(response);
  }

  async updateIdentity(
    userId: string,
    payload: Partial<ResearchProfileIdentity>
  ): Promise<ResearchProfileIdentity> {
    const response = await api.put(`/research/profile/${userId}/identity`, payload);
    return unwrapResponse<ResearchProfileIdentity>(response);
  }

  async syncProfile(userId: string, sourcePreference: 'all' | 'orcid' | 'scopus' | 'openalex' = 'all'): Promise<PublicationSyncResult> {
    // Sync can take up to 2 minutes when querying multiple external APIs (OpenAlex, ORCID, Scopus)
    const response = await api.post(`/research/profile/${userId}/sync`, { sourcePreference }, { timeout: 120000 });
    return unwrapResponse<PublicationSyncResult>(response);
  }

  async getImportRuns(userId: string, limit = 10): Promise<PublicationImportRun[]> {
    const response = await api.get(`/research/profile/${userId}/import-runs`, {
      params: { limit },
    });
    return unwrapResponse<PublicationImportRun[]>(response);
  }

  async importPublications(
    userId: string,
    publications: ManualProfileImportPublication[],
    importFormat: 'bibtex' | 'ris' | 'csv'
  ): Promise<PublicationSyncResult> {
    const response = await api.post(`/research/profile/${userId}/import`, {
      publications,
      importFormat,
    });
    return unwrapResponse<PublicationSyncResult>(response);
  }
}

export const researchProfileService = new ResearchProfileService();
