/**
 * Research-related Type Definitions
 */

import type { Nullable } from './api.types';
import type { User, Employee, Student } from './user.types';

// Publication Types
export type PublicationType = 
  | 'research_paper'
  | 'book'
  | 'book_chapter'
  | 'conference_paper'
  | 'patent'
  | 'grant';

// Publication Status
export type PublicationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_mentor_review'
  | 'mentor_approved'
  | 'mentor_rejected'
  | 'under_drd_review'
  | 'drd_approved'
  | 'drd_rejected'
  | 'under_dean_review'
  | 'dean_approved'
  | 'dean_rejected'
  | 'approved'
  | 'rejected'
  | 'revision_requested';

// Quartile Ratings
export type Quartile = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'NOT_INDEXED';

// Author Types
export type AuthorType = 
  | 'faculty'
  | 'staff'
  | 'student'
  | 'internal_faculty'
  | 'internal_staff'
  | 'internal_student'
  | 'external';

// Author Role
export type AuthorRole = 
  | 'first_author'
  | 'corresponding_author'
  | 'first_and_corresponding_author'
  | 'co_author';

// Research Contribution Author
export interface ResearchContributionAuthor {
  id: string;
  contributionId: string;
  userId: Nullable<string>;
  name: string;
  email: Nullable<string>;
  affiliation: Nullable<string>;
  authorOrder: number;
  authorType: AuthorType;
  authorRole: Nullable<AuthorRole>;
  isCorresponding: boolean;
  isInternal: boolean;
  authorCategory?: 'Internal' | 'External';
  incentiveShare: Nullable<number>;
  pointsShare: Nullable<number>;
  user?: User;
}

// Research Contribution
export interface ResearchContribution {
  id: string;
  title: string;
  abstract: Nullable<string>;
  publicationType: PublicationType;
  status: PublicationStatus;
  
  // Publication Details
  journalName: Nullable<string>;
  publisher: Nullable<string>;
  publicationDate: Nullable<string>;
  doi: Nullable<string>;
  issn: Nullable<string>;
  isbn: Nullable<string>;
  volume: Nullable<string>;
  issue: Nullable<string>;
  pageNumbers: Nullable<string>;
  
  // Indexing & Impact
  quartile: Nullable<Quartile>;
  impactFactor: Nullable<number>;
  sjr: Nullable<number>;
  hIndex: Nullable<number>;
  indexingCategories: string[];
  naasRating: Nullable<number>;
  subsidiaryImpactFactor: Nullable<number>;
  
  // Conference Details (for conference papers)
  conferenceName: Nullable<string>;
  conferenceDate: Nullable<string>;
  conferenceLocation: Nullable<string>;
  
  // Book Details (for books/chapters)
  bookTitle: Nullable<string>;
  chapterTitle: Nullable<string>;
  editors: Nullable<string>;
  edition: Nullable<string>;
  
  // Applicant Info
  applicantUserId: string;
  applicantType: 'faculty' | 'staff' | 'student';
  applicant?: Employee | Student;
  
  // Mentor Info
  mentorUserId: Nullable<string>;
  mentor?: Employee;
  
  // Incentive Calculation
  calculatedIncentiveAmount: Nullable<number>;
  calculatedPoints: Nullable<number>;
  
  // File Paths
  // manuscriptFilePath can be a string (old format: S3 key) or an object (new format with s3Key, name, etc.)
  manuscriptFilePath: Nullable<string | { s3Key: string; name: string; size?: number; mimetype?: string }>;
  supportingDocsFilePaths: Nullable<SupportingDocsFilePaths>;
  
  // SDG Goals
  sdg_goals?: string[];
  
  // Authors
  authors: ResearchContributionAuthor[];
  
  // Review Info
  reviews?: ResearchReview[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Supporting Documents File Paths structure
export interface SupportingDocsFilePaths {
  files: Array<{
    name: string;
    path: string;
    size: number;
  }>;
}

// Research Review
export interface ResearchReview {
  id: string;
  contributionId: string;
  reviewerId: string;
  reviewerRole: 'mentor' | 'drd_member' | 'drd_dean';
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  comments: Nullable<string>;
  reviewedAt: Nullable<string>;
  reviewer?: Employee;
  suggestedChanges?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Grant Application
export interface GrantApplication {
  id: string;
  title: string;
  description: Nullable<string>;
  fundingAgency: string;
  grantType: string;
  amount: number;
  currency: string;
  status: GrantStatus;
  
  // Timeline
  startDate: Nullable<string>;
  endDate: Nullable<string>;
  submissionDeadline: Nullable<string>;
  
  // Applicant Info
  applicantUserId: string;
  applicant?: Employee;
  
  // Co-Investigators
  coInvestigators?: GrantCoInvestigator[];
  
  // File Paths
  proposalFilePath: Nullable<string>;
  budgetFilePath: Nullable<string>;
  supportingDocsFilePaths: Nullable<string[]>;
  
  // Incentive Calculation
  calculatedIncentiveAmount: Nullable<number>;
  calculatedPoints: Nullable<number>;
  
  // Review Info
  reviews?: GrantReview[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Grant Status
export type GrantStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'ongoing'
  | 'completed';

// Grant Co-Investigator
export interface GrantCoInvestigator {
  id: string;
  grantId: string;
  userId: Nullable<string>;
  name: string;
  email: Nullable<string>;
  affiliation: Nullable<string>;
  role: 'co_pi' | 'collaborator';
  isInternal: boolean;
  user?: User;
}

// Grant Review
export interface GrantReview {
  id: string;
  grantId: string;
  reviewerId: string;
  reviewerRole: 'drd_member' | 'drd_dean' | 'finance';
  status: 'pending' | 'approved' | 'rejected';
  comments: Nullable<string>;
  reviewedAt: Nullable<string>;
  reviewer?: Employee;
  createdAt: string;
  updatedAt: string;
}

// Policy Types
export interface ResearchIncentivePolicy {
  id: string;
  policyName: string;
  publicationType: PublicationType;
  isActive: boolean;
  
  // Base Amounts
  baseIncentiveAmount: number;
  basePoints: number;
  
  // Author Percentages
  first_author_percentage: number;
  corresponding_author_percentage: number;
  co_author_percentage: number;
  
  // Quartile Multipliers
  q1_multiplier: number;
  q2_multiplier: number;
  q3_multiplier: number;
  q4_multiplier: number;
  
  // Impact Factor Bonuses
  impactFactorBonuses?: Record<string, number>;
  indexingBonuses?: Record<string, number>;
  
  // Validity
  effectiveFrom: string;
  effectiveTo: Nullable<string>;
  
  createdAt: string;
  updatedAt: string;
}

// Form data types
export interface ResearchContributionFormData {
  title: string;
  abstract?: string;
  publicationType: PublicationType;
  journalName?: string;
  publisher?: string;
  publicationDate?: string;
  doi?: string;
  issn?: string;
  isbn?: string;
  volume?: string;
  issue?: string;
  pageNumbers?: string;
  quartile?: Quartile;
  impactFactor?: number;
  sjr?: number;
  indexingCategories?: string[];
  mentorUserId?: string;
  authors: ResearchAuthorFormData[];
}

export interface ResearchAuthorFormData {
  userId?: string;
  name: string;
  email?: string;
  affiliation?: string;
  authorOrder: number;
  authorType: AuthorType;
  isCorresponding: boolean;
}
