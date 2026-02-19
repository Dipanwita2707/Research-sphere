/**
 * Noting & Approval System - Category, Subcategory Configuration
 * 
 * WORKFLOW SYSTEM:
 * All noting approvals now work through the Reporting Structure system.
 * - User creates noting → Auto-forwards to their manager (if manager has required permission)
 * - Manager can Approve/Reject/Forward up the reporting chain
 * - DEAN role can override and forward to anyone
 * 
 * Permissions determine who can approve what:
 * - dsw_approve_noting: DSW-related notings
 * - event_approve: Event approvals
 * - noting_approve: General noting approvals
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

module.exports = {
  CATEGORIES,
  APPROVAL_PERIOD_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
};
