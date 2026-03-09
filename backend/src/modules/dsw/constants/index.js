/**
 * DSW (Dean of Students' Welfare) Module Constants
 * Defines all constants, enums, and configuration for the DSW system
 */

// Club Status
const ClubStatus = {
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  ARCHIVED: "archived",
};

// Club Lifecycle States
const ClubLifecycleState = {
  DRAFT: "draft",
  UNDER_APPROVAL: "under_approval",
  APPROVED: "approved",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  ARCHIVED: "archived",
};

// Club Target Groups
const ClubTargetGroup = {
  ALL: "all",
  UG: "ug",
  PG: "pg",
  PHD: "phd",
};

// Club Meeting Frequency
const ClubMeetingFrequency = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  HALF_YEARLY: "half_yearly",
  ANNUALLY: "annually",
  EVENT_BASED: "event_based",
};

// Club Change Types
const ClubChangeType = {
  NAME_CHANGE: "name_change",
  CATEGORY_CHANGE: "category_change",
  PURPOSE_CHANGE: "purpose_change",
  FACILITATOR_CHANGE: "facilitator_change",
  CHAIRPERSON_CHANGE: "chairperson_change",
  GOVERNANCE_CHANGE: "governance_change",
  OPERATIONAL_CHANGE: "operational_change",
  OTHER: "other",
};

// Club Change Request Status
const ClubChangeRequestStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const ClubMemberApplicationStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

// Immutable Fields - Cannot be changed after approval without Noting
const IMMUTABLE_CLUB_FIELDS = [
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

// Editable Fields - Can be changed without Noting (only members)
const EDITABLE_CLUB_FIELDS = [
  "proposedEmail",
  "socialMediaHandles",
  "expectedStudentStrength",
  "metadata",
];

// Club Activity Types
const ClubActivityTypes = [
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
];

// DSW Roles for RBAC
const DSWRoles = {
  STUDENT: "student",
  CHAIRPERSON: "chairperson",
  FACULTY_FACILITATOR: "faculty_facilitator",
  DSW_ADMIN: "admin",
  DSW_SUPER_ADMIN: "superadmin",
};

/**
 * @deprecated DSWPermissions is deprecated.
 * Use centralized permissions from backend/src/shared/config/permissions.config.js instead.
 *
 * Migration mapping:
 * - CREATE_CLUB_NOTING    → dsw_create_club_noting
 * - VIEW_CLUB             → dsw_view_club
 * - VIEW_ALL_CLUBS        → dsw_view_all_clubs
 * - VIEW_OWN_CLUBS        → dsw_view_club (context-based)
 * - ADD_MEMBER            → dsw_manage_members
 * - REMOVE_MEMBER         → dsw_manage_members
 * - REQUEST_CLUB_CHANGE   → dsw_request_club_change
 * - APPROVE_CLUB_CHANGE   → dsw_approve_club_change
 * - VIEW_AUDIT_LOGS       → dsw_view_audit_logs
 * - VIEW_CHANGE_REQUESTS  → dsw_view_audit_logs
 *
 * New centralized permissions support:
 * - Role-based default permissions (faculty gets dsw_create_club_noting by default)
 * - Explicit permission assignment via centralDeptPermissions
 * - Granular control through admin UI
 *
 * @see backend/src/shared/config/permissions.config.js - DSW_PERMISSIONS
 * @see backend/src/modules/dsw/middleware/rbac.js - hasPermission() now uses centralized config
 */
const DSWPermissions = {
  // Club Creation
  CREATE_CLUB_NOTING: ["student"],

  // Club Viewing
  VIEW_CLUB: ["student", "faculty", "staff", "admin", "superadmin"],
  VIEW_ALL_CLUBS: ["admin", "superadmin"],
  VIEW_OWN_CLUBS: ["student", "faculty"],

  // Member Management
  ADD_MEMBER: ["chairperson", "faculty_facilitator"],
  REMOVE_MEMBER: ["chairperson", "faculty_facilitator"],

  // Club Modification (via Noting)
  REQUEST_CLUB_CHANGE: ["faculty_facilitator"],
  APPROVE_CLUB_CHANGE: ["admin", "superadmin"],

  // Audit & Monitoring
  VIEW_AUDIT_LOGS: ["admin", "superadmin"],
  VIEW_CHANGE_REQUESTS: ["faculty_facilitator", "admin", "superadmin"],
};

// Audit Actions
const AuditActions = {
  CLUB_CREATED: "club_created",
  CLUB_APPROVED: "club_approved",
  CLUB_ACTIVATED: "club_activated",
  CLUB_SUSPENDED: "club_suspended",
  CLUB_ARCHIVED: "club_archived",
  MEMBER_ADDED: "member_added",
  MEMBER_REMOVED: "member_removed",
  CLUB_APPLICATION_SUBMITTED: "club_application_submitted",
  CLUB_APPLICATION_APPROVED: "club_application_approved",
  CLUB_APPLICATION_REJECTED: "club_application_rejected",
  CHANGE_REQUESTED: "change_requested",
  CHANGE_APPROVED: "change_approved",
  CHANGE_REJECTED: "change_rejected",
  FIELD_UPDATED: "field_updated",
};

// Noting Integration
const DSWNotingConfig = {
  CATEGORY: "administrative",
  SUBCATEGORY: "dsw_club_creation",
  SUB_SUBCATEGORY: "Club Creation",
};

// Error Messages
const ErrorMessages = {
  CLUB_NOT_FOUND: "Club not found",
  UNAUTHORIZED: "You are not authorized to perform this action",
  INVALID_STATUS_TRANSITION: "Invalid status transition",
  IMMUTABLE_FIELD_UPDATE:
    "Cannot update immutable field without Noting approval",
  DUPLICATE_CLUB_NAME: "Club name already exists",
  DUPLICATE_MEMBER: "Student is already a member of this club",
  MEMBER_NOT_FOUND: "Member not found in club",
  INVALID_ROLE: "Invalid role for this operation",
  NOTING_REQUIRED: "This change requires a Noting approval",
  CLUB_NOT_ACTIVE: "Club is not in active state",
  INVALID_FACILITATOR: "Faculty facilitator must be a faculty member",
  INVALID_CHAIRPERSON: "Chairperson must be a student",
  INVALID_MEMBER: "Club members must be students",
  DUPLICATE_APPLICATION: "You already have an active application for this club",
  CLUB_APPLICATION_NOT_FOUND: "Club application not found",
  CLUB_APPLICATION_ALREADY_REVIEWED: "This club application has already been reviewed",
};

// Success Messages
const SuccessMessages = {
  CLUB_CREATED: "Club creation noting submitted successfully",
  CLUB_UPDATED: "Club updated successfully",
  CLUB_APPROVED: "Club approved and activated successfully",
  MEMBER_ADDED: "Member added successfully",
  MEMBER_REMOVED: "Member removed successfully",
  CLUB_APPLICATION_SUBMITTED: "Club application submitted successfully",
  CLUB_APPLICATION_REVIEWED: "Club application reviewed successfully",
  CHANGE_REQUEST_SUBMITTED: "Change request submitted successfully",
  CHANGE_REQUEST_APPROVED: "Change request approved successfully",
  CHANGE_REQUEST_REJECTED: "Change request rejected successfully",
};

module.exports = {
  ClubStatus,
  ClubLifecycleState,
  ClubTargetGroup,
  ClubMeetingFrequency,
  ClubChangeType,
  ClubChangeRequestStatus,
  ClubMemberApplicationStatus,
  IMMUTABLE_CLUB_FIELDS,
  EDITABLE_CLUB_FIELDS,
  ClubActivityTypes,
  DSWRoles,
  DSWPermissions,
  AuditActions,
  DSWNotingConfig,
  ErrorMessages,
  SuccessMessages,
};
