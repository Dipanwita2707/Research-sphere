/**
 * DSW Module Constants
 * Frontend constants for the DSW system
 */

import { ClubTargetGroup, ClubVisibility, ClubMeetingFrequency } from '../types';

// API Endpoints
export const DSW_API_BASE = '/api/v1/dsw';

export const DSW_API_ENDPOINTS = {
  // Clubs
  CLUBS: `${DSW_API_BASE}/clubs`,
  CLUB_BY_ID: (id: string) => `${DSW_API_BASE}/clubs/${id}`,
  MY_CLUBS: `${DSW_API_BASE}/clubs/my`,
  CLUB_MEMBERS: (id: string) => `${DSW_API_BASE}/clubs/${id}/members`,
  ADD_MEMBER: (id: string) => `${DSW_API_BASE}/clubs/${id}/members`,
  REMOVE_MEMBER: (clubId: string, memberId: string) =>
    `${DSW_API_BASE}/clubs/${clubId}/members/${memberId}`,

  // Categories
  CATEGORIES: `${DSW_API_BASE}/categories`,
  CATEGORY_BY_ID: (id: string) => `${DSW_API_BASE}/categories/${id}`,
  SEED_CATEGORIES: `${DSW_API_BASE}/categories/seed/default`,

  // Noting Integration (Club creation now creates noting automatically)
  CREATE_CLUB: `${DSW_API_BASE}/clubs`, // Creates club noting that goes through approval workflow
  CREATE_CHANGE_REQUEST: (clubId: string) => `${DSW_API_BASE}/noting/club-change/${clubId}`,

  // Audit Logs
  CLUB_AUDIT_LOGS: (clubId: string) => `${DSW_API_BASE}/clubs/${clubId}/audit-logs`,
  MY_AUDIT_LOGS: `${DSW_API_BASE}/audit-logs/my`,

  // Statistics
  STATISTICS: `${DSW_API_BASE}/statistics`,

  // Health
  HEALTH: `${DSW_API_BASE}/health`,
};

// Activity Types
export const ACTIVITY_TYPES = [
  'Events',
  'Workshops',
  'Competitions',
  'Awareness Drives',
  'Collaborations',
  'Seminars',
  'Training Programs',
  'Community Service',
  'Research Projects',
  'Cultural Programs',
] as const;

// Infrastructure Types
export const INFRASTRUCTURE_TYPES = [
  'Auditorium',
  'Classroom',
  'Lab',
  'Open Ground',
  'Sports Facility',
  'Conference Room',
  'Studio',
  'Library Space',
] as const;

// Target Groups
export const TARGET_GROUPS: { value: ClubTargetGroup; label: string; description: string }[] = [
  { value: 'all', label: 'All Students', description: 'Open to all students' },
  { value: 'ug', label: 'Undergraduate', description: 'UG students only' },
  { value: 'pg', label: 'Postgraduate', description: 'PG students only' },
  { value: 'phd', label: 'PhD', description: 'PhD scholars only' },
];

// Visibility Options
export const VISIBILITY_OPTIONS: {
  value: ClubVisibility;
  label: string;
  description: string;
}[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Discoverable by all students',
  },
  {
    value: 'restricted',
    label: 'Restricted',
    description: 'Invite/approval based',
  },
];

// Meeting Frequency Options
export const MEETING_FREQUENCY_OPTIONS: {
  value: ClubMeetingFrequency;
  label: string;
}[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'event_based', label: 'Event-based' },
];

// Club Creation Steps
export const CLUB_CREATION_STEPS = [
  {
    id: 1,
    title: 'Core Identity',
    description: 'Basic club information',
    fields: ['name', 'categoryId', 'purpose', 'academicSession'],
  },
  {
    id: 2,
    title: 'Authority & Membership',
    description: 'Vice Chairperson and initial members',
    fields: ['viceChairpersonId', 'initialMembers'],
  },
  {
    id: 3,
    title: 'Governance & Compliance',
    description: 'Target group and activity types',
    fields: [
      'targetStudentGroup',
      'expectedActivityTypes',
      'codeOfConductAccepted',
      'antiDiscriminationAccepted',
    ],
  },
  {
    id: 4,
    title: 'Operational Planning',
    description: 'Meeting frequency and resources',
    fields: [
      'meetingFrequency',
      'estimatedAnnualActivityCount',
      'infrastructureRequirements',
      'fundingRequired',
      'estimatedFundingAmount',
    ],
  },
  {
    id: 5,
    title: 'Visibility & Collaboration',
    description: 'Club visibility settings',
    fields: ['visibility', 'allowInternalCollaboration', 'allowExternalCollaboration'],
  },
  {
    id: 6,
    title: 'Optional Metadata',
    description: 'Additional information',
    fields: ['proposedEmail', 'socialMediaHandles', 'expectedStudentStrength'],
  },
];

// Immutable Fields (cannot be edited after approval)
export const IMMUTABLE_FIELDS = [
  'name',
  'categoryId',
  'purpose',
  'academicSession',
  'facultyFacilitatorId',
  'viceChairpersonId',
  'targetStudentGroup',
  'expectedActivityTypes',
  'codeOfConductAccepted',
  'antiDiscriminationAccepted',
  'meetingFrequency',
  'estimatedAnnualActivityCount',
  'infrastructureRequirements',
  'fundingRequired',
  'estimatedFundingAmount',
  'visibility',
  'allowInternalCollaboration',
  'allowExternalCollaboration',
];

// Editable Fields (can be changed without noting)
export const EDITABLE_FIELDS = [
  'proposedEmail',
  'socialMediaHandles',
  'expectedStudentStrength',
  'metadata',
];

// Status Labels
export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  pending_approval: { label: 'Pending Approval', color: 'yellow' },
  approved: { label: 'Approved', color: 'green' },
  active: { label: 'Active', color: 'blue' },
  suspended: { label: 'Suspended', color: 'red' },
  archived: { label: 'Archived', color: 'gray' },
};

// Club status config for badge UI (Tailwind classes)
export const CLUB_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
  pending_approval: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
  suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
};

// Audit Action Labels
export const AUDIT_ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  club_created: { label: 'Club Created', icon: '🎉' },
  club_approved: { label: 'Club Approved', icon: '✅' },
  club_activated: { label: 'Club Activated', icon: '🚀' },
  club_suspended: { label: 'Club Suspended', icon: '⏸️' },
  club_archived: { label: 'Club Archived', icon: '📦' },
  member_added: { label: 'Member Added', icon: '➕' },
  member_removed: { label: 'Member Removed', icon: '➖' },
  change_requested: { label: 'Change Requested', icon: '📝' },
  change_approved: { label: 'Change Approved', icon: '✅' },
  change_rejected: { label: 'Change Rejected', icon: '❌' },
  field_updated: { label: 'Field Updated', icon: '📝' },
};

// Default Values
export const DEFAULT_CLUB_FORM_VALUES = {
  name: '',
  categoryId: '',
  purpose: '',
  academicSession: '',
  viceChairpersonId: '',
  targetStudentGroup: 'all' as ClubTargetGroup,
  expectedActivityTypes: [],
  codeOfConductAccepted: false,
  antiDiscriminationAccepted: false,
  meetingFrequency: 'monthly' as ClubMeetingFrequency,
  estimatedAnnualActivityCount: 12,
  infrastructureRequirements: [],
  fundingRequired: false,
  visibility: 'public' as ClubVisibility,
  allowInternalCollaboration: true,
  allowExternalCollaboration: false,
  initialMembers: [],
};

// Validation Rules
export const VALIDATION_RULES = {
  clubName: {
    minLength: 3,
    maxLength: 256,
  },
  purpose: {
    minLength: 50,
    maxLength: 5000,
  },
  activityTypes: {
    min: 1,
    max: 10,
  },
  annualActivityCount: {
    min: 1,
    max: 100,
  },
  fundingAmount: {
    min: 0,
    max: 10000000,
  },
  expectedStrength: {
    min: 1,
    max: 1000,
  },
};

// Route Paths
export const DSW_ROUTES = {
  HOME: '/dsw',
  CLUBS: '/dsw/clubs',
  CLUB_DETAIL: (id: string) => `/dsw/clubs/${id}`,
  CREATE_CLUB: '/dsw/clubs/create',
  MY_CLUBS: '/dsw/my-clubs',
  CATEGORIES: '/dsw/categories',
  STATISTICS: '/dsw/statistics',
  AUDIT_LOGS: '/dsw/audit-logs',
};

// Error Messages
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email format',
  MIN_LENGTH: (min: number) => `Minimum ${min} characters required`,
  MAX_LENGTH: (max: number) => `Maximum ${max} characters allowed`,
  MIN_VALUE: (min: number) => `Minimum value is ${min}`,
  MAX_VALUE: (max: number) => `Maximum value is ${max}`,
  MIN_SELECTIONS: (min: number) => `Select at least ${min} option(s)`,
  ACCEPT_REQUIRED: 'You must accept this declaration',
  FUNDING_AMOUNT_REQUIRED: 'Funding amount is required when funding is needed',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  CLUB_CREATED: 'Club creation noting submitted successfully',
  CLUB_UPDATED: 'Club updated successfully',
  MEMBER_ADDED: 'Member added successfully',
  MEMBER_REMOVED: 'Member removed successfully',
  CHANGE_REQUESTED: 'Change request submitted successfully',
};
