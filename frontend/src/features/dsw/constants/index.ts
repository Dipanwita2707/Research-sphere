/**
 * DSW Module Constants
 * Frontend constants for the DSW system
 */

// ─── Club Member Roles ───────────────────────────────────────────────────────

export type ClubMemberRole =
  | "chairperson" // student head of the club (auto-assigned)
  | "technical_head" // 🎯 Tech clubs
  | "creative_head" // 🎨 Design / branding
  | "marketing_head" // 📢 PR / sponsorship
  | "content_head" // 📝 Writing / communication
  | "event_head" // 🎤 Event planning & logistics
  | "coordinator" // 👥 Domain-level coordinators
  | "core_member" // 🧑‍💻 Active regular contributors
  | "volunteer"; // 🙋 Default role on add

export interface ClubMemberRoleConfig {
  label: string;
  emoji: string;
  description: string;
  /** Tailwind bg + text classes */
  className: string;
  /** Leadership tier: 1 = top, 2 = mid, 3 = base */
  tier: 1 | 2 | 3;
}

export const CLUB_MEMBER_ROLES: Record<ClubMemberRole, ClubMemberRoleConfig> = {
  chairperson: {
    label: "Chairperson",
    emoji: "👑",
    description: "Student head of the club",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    tier: 1,
  },
  technical_head: {
    label: "Technical Head",
    emoji: "🎯",
    description: "Plans projects, workshops & hackathons",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    tier: 1,
  },
  creative_head: {
    label: "Creative Head",
    emoji: "🎨",
    description: "Posters, design, branding & visual identity",
    className:
      "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    tier: 1,
  },
  marketing_head: {
    label: "Marketing / PR Head",
    emoji: "📢",
    description: "Sponsorship outreach & promotion strategy",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    tier: 1,
  },
  content_head: {
    label: "Content Head",
    emoji: "📝",
    description: "Blogs, posts & communication tone",
    className:
      "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    tier: 1,
  },
  event_head: {
    label: "Event Head",
    emoji: "🎤",
    description: "Event planning, venue & logistics",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    tier: 1,
  },
  coordinator: {
    label: "Coordinator",
    emoji: "👥",
    description: "Domain-level task execution",
    className:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    tier: 2,
  },
  core_member: {
    label: "Core Member",
    emoji: "🧑‍💻",
    description: "Regular active contributor",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    tier: 2,
  },
  volunteer: {
    label: "Volunteer",
    emoji: "🙋",
    description: "Helps at events, mostly junior students",
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
    tier: 3,
  },
};

/** Roles shown in the "add member" dropdown — ordered for UX */
export const CLUB_MEMBER_ROLE_OPTIONS: {
  value: ClubMemberRole;
  label: string;
  emoji: string;
}[] = [
  { value: "technical_head", label: "Technical Head", emoji: "🎯" },
  { value: "creative_head", label: "Creative Head", emoji: "🎨" },
  { value: "marketing_head", label: "Marketing / PR Head", emoji: "📢" },
  { value: "content_head", label: "Content Head", emoji: "📝" },
  { value: "event_head", label: "Event Head", emoji: "🎤" },
  { value: "coordinator", label: "Coordinator", emoji: "👥" },
  { value: "core_member", label: "Core Member", emoji: "🧑‍💻" },
  { value: "volunteer", label: "Volunteer", emoji: "🙋" },
];

export const DEFAULT_MEMBER_ROLE: ClubMemberRole = "volunteer";

import { ClubTargetGroup, ClubMeetingFrequency } from "../types";

// API Endpoints
export const DSW_API_BASE = "/dsw";

export const DSW_API_ENDPOINTS = {
  // Clubs
  CLUBS: `${DSW_API_BASE}/clubs`,
  CLUB_BY_ID: (id: string) => `${DSW_API_BASE}/clubs/${id}`,
  MY_CLUBS: `${DSW_API_BASE}/clubs/my`,
  MY_CLUB_REQUESTS: `${DSW_API_BASE}/clubs/my-requests`,
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
  CREATE_CHANGE_REQUEST: (clubId: string) =>
    `${DSW_API_BASE}/noting/club-change/${clubId}`,

  // Audit Logs
  CLUB_AUDIT_LOGS: (clubId: string) =>
    `${DSW_API_BASE}/clubs/${clubId}/audit-logs`,
  MY_AUDIT_LOGS: `${DSW_API_BASE}/audit-logs/my`,

  // Statistics
  STATISTICS: `${DSW_API_BASE}/statistics`,

  // Health
  HEALTH: `${DSW_API_BASE}/health`,
};

// Activity Types
export const ACTIVITY_TYPES = [
  "Events",
  "Workshops",
  "Competitions",
  "Awareness Drives",
  "Collaborations",
  "Seminars",
  "Training Programs",
  "Community Service",
  "Research Projects",
  "Cultural Programs",
] as const;

// Meeting Frequency Options
export const MEETING_FREQUENCY_OPTIONS: {
  value: ClubMeetingFrequency;
  label: string;
}[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "annually", label: "Annually" },
  { value: "event_based", label: "Event-Based" },
];

export const CLUB_CREATION_STEPS = [
  {
    id: 1,
    title: "Club Details",
    description: "Name, category, purpose, target group and activities",
    fields: [
      "name",
      "categoryId",
      "purpose",
      "academicSession",
      "targetStudentGroup",
      "expectedActivityTypes",
    ],
  },
  {
    id: 2,
    title: "People & Operations",
    description: "Faculty facilitator, members and operational planning",
    fields: [
      "facultyFacilitatorId",
      "chairpersonId",
      "initialMembers",
      "meetingFrequency",
      "estimatedAnnualActivityCount",
      "expectedStudentStrength",
    ],
  },
  {
    id: 3,
    title: "Declarations & Submit",
    description: "Compliance declarations and optional info",
    fields: [
      "codeOfConductAccepted",
      "antiDiscriminationAccepted",
      "proposedEmail",
      "socialMediaHandles",
    ],
  },
];

// Immutable Fields (cannot be edited after approval)
export const IMMUTABLE_FIELDS = [
  "name",
  "categoryId",
  "purpose",
  "academicSession",
  "facultyFacilitatorId",
  "chairpersonId",
  "targetStudentGroup",
  "expectedActivityTypes",
  "codeOfConductAccepted",
  "antiDiscriminationAccepted",
  "meetingFrequency",
  "estimatedAnnualActivityCount",
];

// Editable Fields (can be changed without noting)
export const EDITABLE_FIELDS = [
  "proposedEmail",
  "socialMediaHandles",
  "expectedStudentStrength",
  "metadata",
];

// Status Labels
export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "gray" },
  pending_approval: { label: "Pending Approval", color: "yellow" },
  approved: { label: "Approved", color: "green" },
  active: { label: "Active", color: "blue" },
  suspended: { label: "Suspended", color: "red" },
  archived: { label: "Archived", color: "gray" },
};

// Club status config for badge UI (Tailwind classes)
export const CLUB_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  },
  pending_approval: {
    label: "Pending",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  approved: {
    label: "Approved",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  },
  suspended: {
    label: "Suspended",
    className: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400",
  },
};

// Audit Action Labels
export const AUDIT_ACTION_LABELS: Record<
  string,
  { label: string; icon: string }
> = {
  club_created: { label: "Club Created", icon: "🎉" },
  club_approved: { label: "Club Approved", icon: "✅" },
  club_activated: { label: "Club Activated", icon: "🚀" },
  club_suspended: { label: "Club Suspended", icon: "⏸️" },
  club_archived: { label: "Club Archived", icon: "📦" },
  member_added: { label: "Member Added", icon: "➕" },
  member_removed: { label: "Member Removed", icon: "➖" },
  change_requested: { label: "Change Requested", icon: "📝" },
  change_approved: { label: "Change Approved", icon: "✅" },
  change_rejected: { label: "Change Rejected", icon: "❌" },
  field_updated: { label: "Field Updated", icon: "📝" },
};

// Default Values
export const DEFAULT_CLUB_FORM_VALUES = {
  name: "",
  categoryId: "",
  purpose: "",
  academicSession: "",
  facultyFacilitatorId: "",
  chairpersonId: "",
  targetStudentGroup: [] as string[],
  expectedActivityTypes: [],
  codeOfConductAccepted: false,
  antiDiscriminationAccepted: false,
  meetingFrequency: "monthly" as ClubMeetingFrequency,
  estimatedAnnualActivityCount: 12,
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
  expectedStrength: {
    min: 1,
    max: 1000,
  },
};

// Route Paths
export const DSW_ROUTES = {
  HOME: "/dsw",
  CLUBS: "/dsw/clubs",
  CLUB_DETAIL: (id: string) => `/dsw/clubs/${id}`,
  CREATE_CLUB: "/dsw/clubs/create",
  MY_CLUBS: "/dsw/my-clubs",
  CATEGORIES: "/dsw/categories",
  STATISTICS: "/dsw/statistics",
  AUDIT_LOGS: "/dsw/audit-logs",
};

// Error Messages
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: "This field is required",
  INVALID_EMAIL: "Invalid email format",
  MIN_LENGTH: (min: number) => `Minimum ${min} characters required`,
  MAX_LENGTH: (max: number) => `Maximum ${max} characters allowed`,
  MIN_VALUE: (min: number) => `Minimum value is ${min}`,
  MAX_VALUE: (max: number) => `Maximum value is ${max}`,
  MIN_SELECTIONS: (min: number) => `Select at least ${min} option(s)`,
  ACCEPT_REQUIRED: "You must accept this declaration",
  FUNDING_AMOUNT_REQUIRED: "Funding amount is required when funding is needed",
};

// Success Messages
export const SUCCESS_MESSAGES = {
  CLUB_CREATED: "Club creation noting submitted successfully",
  CLUB_UPDATED: "Club updated successfully",
  MEMBER_ADDED: "Member added successfully",
  MEMBER_REMOVED: "Member removed successfully",
  CHANGE_REQUESTED: "Change request submitted successfully",
};
