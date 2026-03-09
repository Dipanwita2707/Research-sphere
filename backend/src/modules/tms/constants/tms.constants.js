/**
 * TMS Constants
 * Enums, status values, limits, and messages used across the TMS module
 */

const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

const MESSAGE_TYPE = {
  GRIEVANCE: 'grievance',
  ASSISTANCE: 'assistance',
  ENQUIRY: 'enquiry',
  FEEDBACK: 'feedback',
};

const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

const ESCALATION_LEVEL = {
  SUB_CATEGORY: 'sub_category',
  CATEGORY: 'category',
  MASTER_CATEGORY: 'master_category',
  REGISTRAR: 'registrar',
  DEAN_ACADEMICS: 'dean_academics',
  VICE_CHANCELLOR: 'vice_chancellor',
};

// The strict escalation chain - each level points to the next
const ESCALATION_CHAIN = [
  ESCALATION_LEVEL.SUB_CATEGORY,
  ESCALATION_LEVEL.CATEGORY,
  ESCALATION_LEVEL.MASTER_CATEGORY,
  // After master_category, branching depends on isAcademic flag:
  // Academic → DEAN_ACADEMICS → VICE_CHANCELLOR
  // Non-Academic → REGISTRAR → VICE_CHANCELLOR
];

const TIMELINE_ACTION = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  ESCALATED: 'escalated',
  FORWARDED: 'forwarded',
  REMARKED: 'remarked',
  STATUS_CHANGED: 'status_changed',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
  AUTO_ESCALATED: 'auto_escalated',
  RATED: 'rated',
};

const LIMITS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_DESCRIPTION_LENGTH: 5000,
  MAX_REMARKS_LENGTH: 2000,
  AUTO_ESCALATION_HOURS: 48,
  MIN_RATING: 1,
  MAX_RATING: 5,
};

const ERROR_MESSAGES = {
  TICKET_NOT_FOUND: 'Ticket not found',
  CATEGORY_NOT_FOUND: 'Category not found',
  SUB_CATEGORY_NOT_FOUND: 'Sub-category not found',
  MASTER_CATEGORY_NOT_FOUND: 'Master category not found',
  NOT_ASSIGNED: 'This ticket is not assigned to you',
  ALREADY_CLOSED: 'This ticket is already closed',
  ALREADY_RESOLVED: 'This ticket is already resolved',
  CANNOT_ESCALATE: 'Cannot escalate ticket further',
  CANNOT_RATE: 'Can only rate resolved or closed tickets',
  ALREADY_RATED: 'This ticket has already been rated',
  INVALID_RATING: 'Rating must be between 1 and 5',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  EMPLOYEE_NOT_FOUND: 'Mapped employee not found for this level',
  DUPLICATE_CATEGORY: 'A category with this name already exists',
};

const SUCCESS_MESSAGES = {
  TICKET_CREATED: 'Ticket submitted successfully',
  TICKET_UPDATED: 'Ticket updated successfully',
  TICKET_ESCALATED: 'Ticket escalated successfully',
  TICKET_FORWARDED: 'Ticket forwarded successfully',
  TICKET_RESOLVED: 'Ticket resolved successfully',
  TICKET_CLOSED: 'Ticket closed successfully',
  TICKET_REOPENED: 'Ticket reopened successfully',
  REMARK_ADDED: 'Remark added successfully',
  RATING_SUBMITTED: 'Rating submitted successfully',
  CATEGORY_CREATED: 'Category created successfully',
  CATEGORY_UPDATED: 'Category updated successfully',
  CATEGORY_DELETED: 'Category deleted successfully',
};

module.exports = {
  TICKET_STATUS,
  MESSAGE_TYPE,
  PRIORITY,
  ESCALATION_LEVEL,
  ESCALATION_CHAIN,
  TIMELINE_ACTION,
  LIMITS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};
