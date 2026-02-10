/**
 * Noting & Approval System - Category, Subcategory, and Flow Configuration
 */

const CATEGORIES = {
  academic: {
    label: 'Academic',
    subcategories: {
      events: { label: 'Events', idCode: 'EVENT' },
      curriculum: { label: 'Curriculum', idCode: 'CURR' },
      student_related: { label: 'Student Related', idCode: 'STUDENT' },
      exam: { label: 'Exam', idCode: 'EXAM' },
      miscellaneous: { label: 'Miscellaneous', idCode: 'MISC' },
    },
  },
  administrative: {
    label: 'Administrative',
    subcategories: {
      infrastructure: { label: 'Infrastructure', idCode: 'INFRA' },
      accounts_purchase: { label: 'Accounts & Purchase', idCode: 'ACCOUNTS' },
      non_academic_resources: { label: 'Non-Academic / Resources', idCode: 'RESOURCES' },
      dsw_club_creation: { label: 'DSW - Club Creation', idCode: 'DSWCLUB' },
    },
  },
};

const APPROVAL_PERIOD_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'recurring', label: 'Recurring' },
];

const RECURRING_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'annually', label: 'Annually' },
];

/** Authority role keys stored in noting_authority table (university-level). DSW and CENTRAL_TEAM support multiple members. */
const AUTHORITY_ROLES = {
  DSW: 'DSW',
  COE: 'COE',
  DAA: 'DAA',
  ACCOUNTS_HEAD: 'ACCOUNTS_HEAD',
  PURCHASE_HEAD: 'PURCHASE_HEAD',
  HR_HEAD: 'HR_HEAD',
  CONSTRUCTION_TEAM_HEAD: 'CONSTRUCTION_TEAM_HEAD',
  HIGHER_AUTHORITY: 'HIGHER_AUTHORITY',
  CENTRAL_TEAM: 'CENTRAL_TEAM',
};

/** Authority types that are backed by existing Central Departments (see /admin/central-departments). Members are resolved from CentralDepartmentPermission for that department. */
const CENTRAL_DEPARTMENT_ROLES = ['DSW', 'CENTRAL_TEAM'];
/** Map authority role key → central department code (departmentCode in central_department table). */
const CENTRAL_DEPARTMENT_ROLE_TO_DEPT_CODE = { DSW: 'DSW', CENTRAL_TEAM: 'CENTRAL_TEAM' };

/**
 * Designation strings used as fallback when HOD/Dean is not explicitly set on department/school.
 * First match (case-insensitive) wins.
 */
const HOD_DESIGNATION_MATCH = ['head of department', 'hod', 'department head', 'head, department'];
const DEAN_DESIGNATION_MATCH = ['dean', 'dean of school', 'head of faculty', 'head of school'];

/**
 * Flow: ordered list of authority types for each category + subcategory + creatorRole.
 * noteContext: { amountRequired } used e.g. for Infrastructure (Accounts step only if amount involved).
 * 
 * IMPORTANT: Approve vs Forward Behavior
 * - APPROVE: Note is immediately marked as APPROVED and workflow ends. No further forwarding.
 * - FORWARD: Note moves to the next authority in the flow defined below and remains PENDING.
 * 
 * The flows below represent the POSSIBLE path if the note is forwarded through each step.
 * At ANY step, if an approver clicks "Approve", the note is finalized with status=APPROVED.
 *
 * NOTE: Students are NO LONGER allowed to access noting system.
 * All flows are for Faculty, Staff, and Admin roles only.
 *
 * A. Academic → Events: Creator → HOD → Dean → Central Team (central; any member) → Higher Authority
 * B. Academic → Curriculum: Creator → DAA → Higher Authority
 * C. Academic → Student Related: Creator → Dean → Higher Authority
 * D. Academic → Exam: Creator → Dean → COE → Higher Authority
 * E. Administrative → Infrastructure: Creator → Dean → Construction → (Accounts if amount) → Higher Authority
 * F. Administrative → Accounts & Purchase: Creator → Accounts → Purchase → Higher Authority
 * G. Administrative → Non-Academic/Resources: Creator → HR → Higher Authority
 */
function getFlowDefinition(category, subcategory, creatorRole, noteContext = {}) {
  const amountRequired = noteContext.amountRequired === true;

  if (category === 'academic') {
    switch (subcategory) {
      case 'events':
        return ['HOD', 'DEAN', 'CENTRAL_TEAM', 'HIGHER_AUTHORITY'];
      case 'curriculum':
        return ['DAA', 'HIGHER_AUTHORITY'];
      case 'student_related':
        return ['DEAN', 'HIGHER_AUTHORITY'];
      case 'exam':
        return ['DEAN', 'COE', 'HIGHER_AUTHORITY'];
      case 'miscellaneous':
        return ['HOD', 'DEAN', 'CENTRAL_TEAM', 'HIGHER_AUTHORITY'];
      default:
        return ['DEAN', 'HIGHER_AUTHORITY'];
    }
  }

  if (category === 'administrative') {
    switch (subcategory) {
      case 'infrastructure':
        if (amountRequired) return ['DEAN', 'CONSTRUCTION_TEAM_HEAD', 'ACCOUNTS_HEAD', 'HIGHER_AUTHORITY'];
        return ['DEAN', 'CONSTRUCTION_TEAM_HEAD', 'HIGHER_AUTHORITY'];
      case 'accounts_purchase':
        return ['ACCOUNTS_HEAD', 'PURCHASE_HEAD', 'HIGHER_AUTHORITY'];
      case 'non_academic_resources':
        return ['HR_HEAD', 'HIGHER_AUTHORITY'];
      case 'dsw_club_creation':
        // Club Creation: Faculty → HOD → Dean → DSW Team (any member can approve) → Higher Authority
        return ['HOD', 'DEAN', 'DSW', 'HIGHER_AUTHORITY'];
      default:
        return ['DEAN', 'HIGHER_AUTHORITY'];
    }
  }

  return ['DEAN', 'HIGHER_AUTHORITY'];
}

function isCentralDepartmentRole(authorityType) {
  return CENTRAL_DEPARTMENT_ROLES.includes(authorityType);
}

module.exports = {
  CATEGORIES,
  APPROVAL_PERIOD_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
  AUTHORITY_ROLES,
  CENTRAL_DEPARTMENT_ROLES,
  CENTRAL_DEPARTMENT_ROLE_TO_DEPT_CODE,
  isCentralDepartmentRole,
  getFlowDefinition,
  HOD_DESIGNATION_MATCH,
  DEAN_DESIGNATION_MATCH,
};
