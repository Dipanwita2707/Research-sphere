/**
 * Event Management Constants
 * 
 * This file contains all constants used across the Event Management module
 */

const EVENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const EVENT_TYPE = {
  SEMINAR: 'seminar',
  WORKSHOP: 'workshop',
  FEST: 'fest',
  CONFERENCE: 'conference',
  COMPETITION: 'competition',
  CULTURAL: 'cultural',
  TECHNICAL: 'technical',
  SPORTS: 'sports',
  OTHER: 'other',
};

const PAYMENT_TYPE = {
  FREE: 'free',
  PAID: 'paid',
};

const REGISTRATION_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  WAITLISTED: 'waitlisted',
  REJECTED: 'rejected',
  INCOMPLETE_TEAM: 'incomplete_team',
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const ENTRY_TYPE = {
  ENTRY: 'entry',
  EXIT: 'exit',
};

const LIMITS = {
  MAX_EVENT_NAME_LENGTH: 256,
  MAX_DESCRIPTION_LENGTH: 5000,
  MAX_VENUE_LENGTH: 512,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

const ERRORS = {
  EVENT_NOT_FOUND: 'Event not found',
  NOTING_NOT_APPROVED: 'Noting must be approved before creating an event',
  NOTING_ALREADY_HAS_EVENT: 'An event already exists for this noting',
  EVENT_NOT_PUBLISHED: 'Event is not published yet',
  REGISTRATION_CLOSED: 'Registration is closed for this event',
  ALREADY_REGISTERED: 'You are already registered for this event',
  EVENT_FULL: 'Event has reached maximum capacity',
  REGISTRATION_NOT_FOUND: 'Registration not found',
  INVALID_QR_CODE: 'Invalid QR code',
  ALREADY_ENTERED: 'User has already entered. Check out first before checking in again.',
  NOT_CHECKED_IN: 'User has not checked in yet. Check in first before checking out.',
  NOT_A_VOLUNTEER: 'You are not authorized as a volunteer for this event',
  INVALID_EVENT_DATES: 'Event end date must be after start date',
  REGISTRATION_DATES_INVALID: 'Registration dates must be within event dates',
};

module.exports = {
  EVENT_STATUS,
  EVENT_TYPE,
  PAYMENT_TYPE,
  REGISTRATION_STATUS,
  PAYMENT_STATUS,
  ENTRY_TYPE,
  LIMITS,
  ERRORS,
};
