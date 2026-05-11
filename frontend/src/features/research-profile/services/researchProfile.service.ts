import api, { unwrapResponse } from '@/shared/api/api';

export interface ResearchProfileIdentity {
  id: string | null;
  userId: string;
  orcid: string | null;
  scopusAuthorId: string | null;
  webOfScienceId?: string | null;
  affiliationAliases?: string[];
  autoSyncEnabled: boolean;
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

class ResearchProfileService {
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
