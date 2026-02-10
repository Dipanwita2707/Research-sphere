/**
 * Noting System Constants
 * Centralizes all magic numbers and strings
 */

// Field Length Limits
const LIMITS = {
  FILE_PATH_MAX_LENGTH: 512,
  FILE_NAME_MAX_LENGTH: 256,
  FILE_DESCRIPTION_MAX_LENGTH: 2000,
  DESCRIPTION_MAX_WORDS: 500,
  PENDING_NOTES_FETCH_LIMIT: 100, // Reduced from 500 for better performance
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// Note Status Values
const NOTE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVERTED: 'reverted',
};

// Note Actions for History
const NOTE_ACTIONS = {
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FORWARDED: 'forwarded',
  REVERTED: 'reverted',
  RESUBMITTED: 'resubmitted',
};

// Approval Period Options
const APPROVAL_PERIODS = {
  ONE_TIME: 'one_time',
  RECURRING: 'recurring',
};

// Recurring Frequency Options
const RECURRING_FREQUENCIES = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  HALF_YEARLY: 'half_yearly',
  ANNUALLY: 'annually',
};

module.exports = {
  LIMITS,
  NOTE_STATUS,
  NOTE_ACTIONS,
  APPROVAL_PERIODS,
  RECURRING_FREQUENCIES,
};
