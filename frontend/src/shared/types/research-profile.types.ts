/**
 * Research Profile System Type Definitions
 * 
 * These types define the data models for the Research Profile System,
 * which provides Google Scholar-style researcher profiles with citation
 * metrics, publication lists, and co-author network visualizations.
 */

import type { Nullable } from './api.types';

// ============================================================================
// Profile Visibility and Access Control
// ============================================================================

export type ProfileVisibility = 'public' | 'institution' | 'private';

export interface ProfileVisibilitySettings {
  profile: ProfileVisibility;
  showEmail: boolean;
  showPhone: boolean;
  showResearchInterests: boolean;
  showPublications: boolean;
  showCoAuthors: boolean;
  showMetrics: boolean;
}

// ============================================================================
// Citation Metrics
// ============================================================================

export interface CitationMetrics {
  hIndex: number;
  i10Index: number;
  totalCitations: number;
  citationsPerYear: YearlyCitations[];
  avgCitationsPerPaper: number;
}

export interface YearlyCitations {
  year: number;
  count: number;
}

export interface ImpactMetrics {
  avgCitationsPerPaper: number;
  medianCitations: number;
  highlyCitedPapers: number; // Papers with >10 citations
  citationDistribution: CitationDistribution[];
}

export interface CitationDistribution {
  range: string; // e.g., "0-5", "6-10", "11-20", "21+"
  count: number;
}

// ============================================================================
// Publications
// ============================================================================

export type PublicationSource = 'google_scholar' | 'scopus' | 'web_of_science' | 'manual';

export interface Publication {
  id: string;
  profileId: string;
  researchContributionId: Nullable<string>; // Link to existing research module
  
  // Publication Details
  title: string;
  authors: PublicationAuthor[];
  venue: string; // Journal/Conference name
  publicationType: string; // journal, conference, book_chapter, etc.
  year: number;
  volume: Nullable<string>;
  issue: Nullable<string>;
  pages: Nullable<string>;
  
  // Identifiers
  doi: Nullable<string>;
  isbn: Nullable<string>;
  issn: Nullable<string>;
  arxivId: Nullable<string>;
  pubmedId: Nullable<string>;
  
  // Citation Data
  citationCount: number;
  citationsPerYear: Record<number, number>; // { year: count }
  
  // Source Information
  source: PublicationSource;
  externalId: Nullable<string>;
  
  // URLs
  pdfUrl: Nullable<string>;
  publicationUrl: Nullable<string>;
  
  // Metadata
  abstract: Nullable<string>;
  keywords: string[];
  isVerified: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export interface PublicationAuthor {
  name: string;
  affiliation: Nullable<string>;
  email: Nullable<string>;
  isCorresponding: boolean;
  authorOrder: number;
}

// ============================================================================
// Co-Author Network
// ============================================================================

export interface CoAuthor {
  id: string;
  name: string;
  affiliation: Nullable<string>;
  email: Nullable<string>;
  profileId: Nullable<string>; // Link to their profile if they have one
  collaborationCount: number;
  firstCollaboration: number; // Year
  lastCollaboration: number; // Year
  sharedPublications: string[]; // Publication IDs
  scopusAuthorId?: Nullable<string>;
  orcid?: Nullable<string>;
}

export interface NetworkNode {
  id: string;
  name: string;
  affiliation: string;
  collaborationCount: number;
  isMainAuthor?: boolean; // True for the profile owner
  scopusAuthorId?: string | null;
  orcid?: string | null;
}

export interface NetworkEdge {
  source: string; // Node ID
  target: string; // Node ID
  weight: number; // Number of collaborations
  publications: string[]; // Publication IDs
}

export interface CoAuthorNetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

// ============================================================================
// Research Profile
// ============================================================================

export interface ResearchProfile {
  id: string;
  userId: string;
  
  // External Profile IDs
  googleScholarId: Nullable<string>;
  scopusAuthorId: Nullable<string>;
  webOfScienceId: Nullable<string>;
  orcid: Nullable<string>;
  
  // Profile Information
  researchInterests: string[];
  bio: Nullable<string>;
  personalWebsite: Nullable<string>;
  
  // Citation Metrics (cached)
  metrics: CitationMetrics;
  
  // Visibility Settings
  visibility: ProfileVisibilitySettings;
  
  // Sync Status
  lastSyncedAt: Nullable<string>;
  syncStatus: SyncStatus;
  syncError: Nullable<string>;
  autoSyncEnabled: boolean;
  filterSgtOnly: boolean;
  syncFrequencyDays: number;
  
  // Metadata
  profileCompleteness: number; // 0-100
  isVerified: boolean;
  verifiedAt: Nullable<string>;
  verifiedBy: Nullable<string>;
  
  createdAt: string;
  updatedAt: string;
}

export type SyncStatus = 
  | 'never_synced'
  | 'syncing'
  | 'success'
  | 'failed'
  | 'pending';

// ============================================================================
// Complete Profile Data (for display)
// ============================================================================

export interface ProfileData {
  user: {
    uid: string;
    name: string;
    email: string;
    photo: Nullable<string>;
    designation: string;
    department: string;
    school: string;
  };
  profile: ResearchProfile;
  publications: Publication[];
  coAuthors: CoAuthor[];
  impactMetrics: ImpactMetrics;
}

// ============================================================================
// Profile Sync
// ============================================================================

export interface SyncProfileRequest {
  source: 'google_scholar' | 'scopus' | 'web_of_science';
  profileId: string;
}

export interface SyncProfileResponse {
  status: 'success' | 'pending' | 'failed';
  syncId: string;
  newPublications: number;
  updatedCitations: number;
  message?: string;
}

// ============================================================================
// Search and Discovery
// ============================================================================

export interface ProfileSearchRequest {
  query: string;
  filters?: {
    department?: string;
    school?: string;
    minCitations?: number;
    yearRange?: { start: number; end: number };
  };
  page: number;
  limit: number;
}

export interface ProfileSearchResult {
  userId: string;
  name: string;
  designation: string;
  department: string;
  school: string;
  hIndex: number;
  totalCitations: number;
  recentPublications: number;
  matchScore: number;
  photo: Nullable<string>;
}

export interface ProfileSearchResponse {
  results: ProfileSearchResult[];
  total: number;
  page: number;
  hasMore: boolean;
}

// ============================================================================
// External Profile Fetching
// ============================================================================

export type ExternalSource = 'google_scholar' | 'scopus' | 'web_of_science';

export interface ExternalProfile {
  source: ExternalSource;
  externalId: string;
  name: string;
  affiliation: string;
  publications: Publication[];
  metrics: CitationMetrics;
  coAuthors: CoAuthor[];
  fetchedAt: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface GetProfileResponse {
  profile: ProfileData;
  permissions: {
    canEdit: boolean;
    canViewPrivate: boolean;
  };
}

export interface AddPublicationRequest {
  title: string;
  authors: PublicationAuthor[];
  venue: string;
  year: number;
  doi?: string;
  citations?: number;
}
