/**
 * Admin Components
 * Export all admin components from this file for easy importing
 */

// School Assignment Components
export { default as SchoolAssignmentManager } from './SchoolAssignmentManager';
export {
  DRD_MEMBER_CONFIG,
  DRD_RESEARCH_CONFIG,
  DRD_BOOK_CONFIG,
  DRD_GRANT_CONFIG,
  DRD_CONFERENCE_CONFIG,
  type SchoolAssignmentConfig,
  type School,
  type AssignmentMember,
  type SchoolWithMembers,
} from './SchoolAssignmentManager';

// Management Components
export { default as SchoolManagement } from './SchoolManagement';
export { default as DepartmentManagement } from './DepartmentManagement';
export { default as CentralDepartmentManagement } from './CentralDepartmentManagement';
export { default as ProgramManagement } from './ProgramManagement';
export { default as PermissionManagement } from './PermissionManagement';
export { default as UserRoleManagement } from './UserRoleManagement';
export { default as BulkUploadManagement } from './BulkUploadManagement';

// Policy Management Components
export { default as ResearchPolicyManagement } from './ResearchPolicyManagement';
export { default as ConferencePolicyManagement } from './ConferencePolicyManagement';
export { default as BookPolicyManagement } from './BookPolicyManagement';
export { default as BookChapterPolicyManagement } from './BookChapterPolicyManagement';
export { default as GrantIncentivePolicyManagement } from './GrantIncentivePolicyManagement';
export { default as IncentivePolicyManagement } from './IncentivePolicyManagement';

// Dashboard Components
export { default as UniversityAnalyticsDashboard } from './UniversityAnalyticsDashboard';

// Reporting Structure Components
export { default as ReportingStructureManagement } from './ReportingStructureManagement';
