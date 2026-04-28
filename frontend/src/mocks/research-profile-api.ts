/**
 * Mock API Layer for Research Profile System
 * 
 * Provides mock API functions that simulate backend endpoints
 * for development and testing purposes.
 */

import type {
  ProfileData,
  GetProfileResponse,
  ProfileSearchRequest,
  ProfileSearchResponse,
  ProfileSearchResult,
  SyncProfileRequest,
  SyncProfileResponse,
  AddPublicationRequest,
  Publication,
  CoAuthorNetwork,
} from '@/shared/types/research-profile.types';

import {
  generateProfileData,
  generateMultipleProfiles,
  generatePublication,
  generateCoAuthorNetwork,
} from './research-profile-mocks';

// ============================================================================
// In-Memory Data Store
// ============================================================================

class MockDataStore {
  private profiles: Map<string, ProfileData> = new Map();
  private initialized: boolean = false;

  initialize() {
    if (this.initialized) return;
    
    // Generate 20 sample profiles
    const sampleProfiles = generateMultipleProfiles(20);
    sampleProfiles.forEach(profile => {
      this.profiles.set(profile.user.uid, profile);
    });
    
    this.initialized = true;
  }

  getProfile(userId: string): ProfileData | undefined {
    this.initialize();
    return this.profiles.get(userId);
  }

  getAllProfiles(): ProfileData[] {
    this.initialize();
    return Array.from(this.profiles.values());
  }

  addProfile(profile: ProfileData): void {
    this.profiles.set(profile.user.uid, profile);
  }

  updateProfile(userId: string, updates: Partial<ProfileData>): ProfileData | undefined {
    const profile = this.profiles.get(userId);
    if (!profile) return undefined;
    
    const updated = { ...profile, ...updates };
    this.profiles.set(userId, updated);
    return updated;
  }

  addPublication(userId: string, publication: Publication): ProfileData | undefined {
    const profile = this.profiles.get(userId);
    if (!profile) return undefined;
    
    profile.publications.unshift(publication);
    
    // Recalculate metrics (simplified)
    const totalCitations = profile.publications.reduce((sum, p) => sum + p.citationCount, 0);
    profile.profile.metrics.totalCitations = totalCitations;
    profile.profile.metrics.avgCitationsPerPaper = parseFloat(
      (totalCitations / profile.publications.length).toFixed(2)
    );
    
    return profile;
  }

  searchProfiles(query: string, filters?: ProfileSearchRequest['filters']): ProfileSearchResult[] {
    this.initialize();
    const allProfiles = this.getAllProfiles();
    
    let results = allProfiles.map(profile => ({
      userId: profile.user.uid,
      name: profile.user.name,
      designation: profile.user.designation,
      department: profile.user.department,
      school: profile.user.school,
      hIndex: profile.profile.metrics.hIndex,
      totalCitations: profile.profile.metrics.totalCitations,
      recentPublications: profile.publications.filter(
        p => p.year >= new Date().getFullYear() - 2
      ).length,
      matchScore: 0,
      photo: profile.user.photo,
    }));
    
    // Apply search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(r => 
        r.name.toLowerCase().includes(lowerQuery) ||
        r.department.toLowerCase().includes(lowerQuery) ||
        r.school.toLowerCase().includes(lowerQuery)
      );
      
      // Calculate match score
      results.forEach(r => {
        if (r.name.toLowerCase().includes(lowerQuery)) r.matchScore += 10;
        if (r.department.toLowerCase().includes(lowerQuery)) r.matchScore += 5;
        if (r.school.toLowerCase().includes(lowerQuery)) r.matchScore += 3;
      });
    }
    
    // Apply filters
    if (filters) {
      if (filters.department) {
        results = results.filter(r => r.department === filters.department);
      }
      if (filters.school) {
        results = results.filter(r => r.school === filters.school);
      }
      if (filters.minCitations !== undefined) {
        results = results.filter(r => r.totalCitations >= filters.minCitations!);
      }
    }
    
    // Sort by match score and citations
    results.sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return b.totalCitations - a.totalCitations;
    });
    
    return results;
  }
}

const dataStore = new MockDataStore();

// ============================================================================
// Utility Functions
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function simulateNetworkDelay(): Promise<void> {
  // Random delay between 200-800ms to simulate network latency
  return delay(Math.random() * 600 + 200);
}

// ============================================================================
// Mock API Functions
// ============================================================================

/**
 * Get a researcher's profile by user ID
 */
export async function getProfile(userId: string): Promise<GetProfileResponse> {
  await simulateNetworkDelay();
  
  let profile = dataStore.getProfile(userId);
  
  // If profile doesn't exist, generate a new one
  if (!profile) {
    profile = generateProfileData(userId);
    dataStore.addProfile(profile);
  }
  
  return {
    profile,
    permissions: {
      canEdit: true, // In mock, always allow editing
      canViewPrivate: true,
    },
  };
}

/**
 * Search for researcher profiles
 */
export async function searchProfiles(
  request: ProfileSearchRequest
): Promise<ProfileSearchResponse> {
  await simulateNetworkDelay();
  
  const allResults = dataStore.searchProfiles(request.query, request.filters);
  
  // Paginate results
  const start = (request.page - 1) * request.limit;
  const end = start + request.limit;
  const results = allResults.slice(start, end);
  
  return {
    results,
    total: allResults.length,
    page: request.page,
    hasMore: end < allResults.length,
  };
}

/**
 * Sync profile with external database
 */
export async function syncProfile(
  userId: string,
  request: SyncProfileRequest
): Promise<SyncProfileResponse> {
  // Simulate longer delay for sync operation
  await delay(1500);
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    return {
      status: 'failed',
      syncId: `sync_${Date.now()}`,
      newPublications: 0,
      updatedCitations: 0,
      message: 'Profile not found',
    };
  }
  
  // Simulate finding new publications
  const newPublicationsCount = Math.floor(Math.random() * 3);
  const updatedCitationsCount = Math.floor(Math.random() * 10) + 5;
  
  // Add new publications
  for (let i = 0; i < newPublicationsCount; i++) {
    const newPub = generatePublication(profile.profile.id);
    dataStore.addPublication(userId, newPub);
  }
  
  // Update sync status
  dataStore.updateProfile(userId, {
    profile: {
      ...profile.profile,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'success',
    },
  });
  
  return {
    status: 'success',
    syncId: `sync_${Date.now()}`,
    newPublications: newPublicationsCount,
    updatedCitations: updatedCitationsCount,
    message: `Successfully synced with ${request.source}`,
  };
}

/**
 * Add a publication manually
 */
export async function addPublication(
  userId: string,
  request: AddPublicationRequest
): Promise<Publication> {
  await simulateNetworkDelay();
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  const newPublication: Publication = {
    id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    profileId: profile.profile.id,
    researchContributionId: null,
    title: request.title,
    authors: request.authors,
    venue: request.venue,
    publicationType: 'journal',
    year: request.year,
    volume: null,
    issue: null,
    pages: null,
    doi: request.doi || null,
    isbn: null,
    issn: null,
    arxivId: null,
    pubmedId: null,
    citationCount: request.citations || 0,
    citationsPerYear: {},
    source: 'manual',
    externalId: null,
    pdfUrl: null,
    publicationUrl: null,
    abstract: null,
    keywords: [],
    isVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  dataStore.addPublication(userId, newPublication);
  
  return newPublication;
}

/**
 * Get co-author network for a researcher
 */
export async function getCoAuthorNetwork(userId: string): Promise<CoAuthorNetwork> {
  await simulateNetworkDelay();
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  return generateCoAuthorNetwork(profile.user.name, profile.coAuthors);
}

/**
 * Get all publications for a researcher
 */
export async function getPublications(userId: string): Promise<Publication[]> {
  await simulateNetworkDelay();
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  return profile.publications;
}

/**
 * Update profile visibility settings
 */
export async function updateVisibilitySettings(
  userId: string,
  settings: Partial<ProfileData['profile']['visibility']>
): Promise<ProfileData> {
  await simulateNetworkDelay();
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  const updated = dataStore.updateProfile(userId, {
    profile: {
      ...profile.profile,
      visibility: {
        ...profile.profile.visibility,
        ...settings,
      },
    },
  });
  
  if (!updated) {
    throw new Error('Failed to update profile');
  }
  
  return updated;
}

/**
 * Update research interests
 */
export async function updateResearchInterests(
  userId: string,
  interests: string[]
): Promise<ProfileData> {
  await simulateNetworkDelay();
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  const updated = dataStore.updateProfile(userId, {
    profile: {
      ...profile.profile,
      researchInterests: interests,
    },
  });
  
  if (!updated) {
    throw new Error('Failed to update profile');
  }
  
  return updated;
}

/**
 * Update profile fields (bio, website, etc.)
 */
export async function updateProfile(
  userId: string,
  updates: {
    bio?: string;
    personalWebsite?: string;
  }
): Promise<ProfileData> {
  await simulateNetworkDelay();
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  const updated = dataStore.updateProfile(userId, {
    profile: {
      ...profile.profile,
      ...updates,
    },
  });
  
  if (!updated) {
    throw new Error('Failed to update profile');
  }
  
  return updated;
}

/**
 * Get citation metrics for a researcher
 */
export async function getCitationMetrics(userId: string) {
  await simulateNetworkDelay();
  
  const profile = dataStore.getProfile(userId);
  if (!profile) {
    throw new Error('Profile not found');
  }
  
  return {
    metrics: profile.profile.metrics,
    impactMetrics: profile.impactMetrics,
  };
}

/**
 * Get trending researchers (for discovery)
 */
export async function getTrendingResearchers(limit: number = 10): Promise<ProfileSearchResult[]> {
  await simulateNetworkDelay();
  
  const allProfiles = dataStore.getAllProfiles();
  
  // Sort by recent publications and citations
  const trending = allProfiles
    .map(profile => ({
      userId: profile.user.uid,
      name: profile.user.name,
      designation: profile.user.designation,
      department: profile.user.department,
      school: profile.user.school,
      hIndex: profile.profile.metrics.hIndex,
      totalCitations: profile.profile.metrics.totalCitations,
      recentPublications: profile.publications.filter(
        p => p.year >= new Date().getFullYear() - 1
      ).length,
      matchScore: 0,
      photo: profile.user.photo,
    }))
    .sort((a, b) => {
      // Sort by recent publications first, then by h-index
      if (a.recentPublications !== b.recentPublications) {
        return b.recentPublications - a.recentPublications;
      }
      return b.hIndex - a.hIndex;
    })
    .slice(0, limit);
  
  return trending;
}

// ============================================================================
// Export Mock API
// ============================================================================

export const mockResearchProfileAPI = {
  getProfile,
  searchProfiles,
  syncProfile,
  addPublication,
  getCoAuthorNetwork,
  getPublications,
  updateVisibilitySettings,
  updateResearchInterests,
  updateProfile,
  getCitationMetrics,
  getTrendingResearchers,
};
