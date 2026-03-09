/**
 * Input Validation Utilities for Noting System
 * Provides reusable validation functions
 */

const { ValidationError } = require('../../../shared/utils/AppError');
const { LIMITS } = require('../constants/noting.constants');
const { CATEGORIES } = require('../config/noting.config');

/**
 * Validate description field
 * @param {string} description - Description text
 * @param {boolean} required - Whether description is required
 * @returns {string} Trimmed description
 * @throws {ValidationError} If validation fails
 */
function validateDescription(description, required = false) {
  const desc = String(description || '').trim();

  if (required && !desc) {
    throw new ValidationError('Please add a description explaining your request before submitting.');
  }

  if (desc) {
    const wordCount = desc.split(/\s+/).filter(Boolean).length;
    if (wordCount > LIMITS.DESCRIPTION_MAX_WORDS) {
      throw new ValidationError(
        `Description exceeds the word limit. Please reduce to ${LIMITS.DESCRIPTION_MAX_WORDS} words (currently: ${wordCount} words).`
      );
    }
  }

  return desc;
}

/**
 * Validate category and subcategory
 * @param {string} category - Category value
 * @param {string} subcategory - Subcategory value
 * @throws {ValidationError} If validation fails
 */
function validateCategory(category, subcategory) {
  if (!category || !subcategory) {
    throw new ValidationError('Please select both Category and Subcategory.');
  }

  const validCategories = Object.keys(CATEGORIES);
  if (!validCategories.includes(category)) {
    throw new ValidationError(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  const validSubcategories = Object.keys(CATEGORIES[category].subcategories);
  if (!validSubcategories.includes(subcategory)) {
    throw new ValidationError(
      `Invalid subcategory for ${category}. Must be one of: ${validSubcategories.join(', ')}`
    );
  }
}

/**
 * Sanitize and validate attachments array
 * @param {Array} attachmentsPayload - Raw attachments array from request
 * @returns {Array} Validated attachments array
 */
function sanitizeAttachments(attachmentsPayload) {
  if (!Array.isArray(attachmentsPayload)) {
    return [];
  }

  return attachmentsPayload
    .filter((a) => a && (a.filePath || a.fileName))
    .map((a) => ({
      filePath: String(a.filePath || '')
        .trim()
        .slice(0, LIMITS.FILE_PATH_MAX_LENGTH),
      fileName: String(a.fileName || a.filePath || 'attachment')
        .trim()
        .slice(0, LIMITS.FILE_NAME_MAX_LENGTH),
      fileDescription: a.fileDescription
        ? String(a.fileDescription).trim().slice(0, LIMITS.FILE_DESCRIPTION_MAX_LENGTH)
        : null,
    }))
    .filter((a) => a.filePath);
}

/**
 * Sanitize points array
 * @param {Array} points - Points array from request
 * @returns {Array} Validated points array with sort order
 */
function sanitizePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  const trimmed = points
    .map((content) => String(content).trim())
    .filter(Boolean);

  // Dedupe while preserving order (defensive against duplicate sends)
  const seen = new Set();
  const unique = [];
  for (const c of trimmed) {
    if (seen.has(c)) continue;
    seen.add(c);
    unique.push(c);
  }

  return unique.map((content, index) => ({
    sortOrder: index + 1,
    content,
  }));
}

/**
 * Parse policy compliance value
 * @param {string} value - Policy compliance value ('yes', 'no', or anything else)
 * @returns {boolean|null} Boolean or null
 */
function parsePolicyCompliance(value) {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

const { sanitizeSponsors } = require('../../../shared/utils/validators');
const { RECURRING_FREQUENCIES, APPROVAL_PERIODS } = require('../constants/noting.constants');

/** Alias for shared sponsor sanitization (Cash: amount, In-kind: notes) */
function sanitizeEventSponsors(sponsors) {
  return sanitizeSponsors(sponsors);
}

const VALID_RECURRING = Object.values(RECURRING_FREQUENCIES);

const EVENT_SUBCATEGORIES = ['events'];

/**
 * Validate note for submission (create with submit=true or submitDraft)
 * @param {Object} note - Note object with all fields
 * @throws {ValidationError} If validation fails
 */
function validateNoteForSubmission(note) {
  if (note.policyCompliant === null || note.policyCompliant === undefined) {
    throw new ValidationError('Please select Policy Compliance: choose "Yes, complies" or "No" in Additional Details.');
  }

  const points = Array.isArray(note.points) ? note.points : [];
  const validPoints = points.filter((p) => p && String(p.content || '').trim());
  if (validPoints.length === 0) {
    throw new ValidationError('Please add at least one requirement point in the Requirements & Points section.');
  }

  if (note.approvalPeriod === APPROVAL_PERIODS.RECURRING) {
    if (!note.recurringFrequency || !VALID_RECURRING.includes(note.recurringFrequency)) {
      throw new ValidationError('Please select a frequency (e.g. Monthly, Weekly) when Approval Period is Recurring.');
    }
  }

  if (note.amountRequired === true) {
    const amt = note.amount;
    if (amt == null || amt === '' || Number(amt) < 0 || Number.isNaN(Number(amt))) {
      throw new ValidationError('Please enter a valid amount (₹) in Budget / Amount when "Amount required" is selected.');
    }
    const amtNum = Number(amt);
    if (!Number.isInteger(amtNum)) {
      throw new ValidationError('Amount must be a whole number (integer). Decimal values are not allowed.');
    }
    if (amtNum <= 1) {
      throw new ValidationError('Amount must be greater than ₹1.');
    }
    if (amtNum > LIMITS.AMOUNT_MAX) {
      throw new ValidationError(`Amount cannot exceed ₹10,00,000 (10 lakh). Please reduce the amount.`);
    }
  }

  // Event noting validation — when subcategory is events, event structure is required
  const subcategory = (note.subcategory || '').toLowerCase();
  const isEventSubcategory = EVENT_SUBCATEGORIES.some((s) => subcategory.includes(s));
  const notingEventType = note.notingEventType;

  if (isEventSubcategory && !notingEventType) {
    throw new ValidationError('Please select Event Structure: Venue Event, Stall-Based Event, or Fest.');
  }
  if (notingEventType === 'venue' || notingEventType === 'stall') {
    const { eventName, eventType, eventStartDate, eventEndDate, eventPaymentType, eventParticipationType, eventRegistrationFeeIndividual, eventRegistrationFeeTeam, eventHasSponsorship, eventSponsors, eventHasResources, eventResources, eventDutyLeaveAvailable, eventDutyLeaveRoleType, stallConfig } = note;
    if (!eventName || !String(eventName).trim()) throw new ValidationError('Please enter the Event Name.');
    if (!eventType) throw new ValidationError('Please select the Event Type (e.g. Workshop, Seminar).');
    if (!eventStartDate) throw new ValidationError('Please select the Event Start Date.');
    if (!eventEndDate) throw new ValidationError('Please select the Event End Date.');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (eventStartDate && new Date(eventStartDate) < todayStart) {
      throw new ValidationError('Event Start Date cannot be in the past. Please select a future date.');
    }
    if (eventStartDate && eventEndDate && new Date(eventEndDate) < new Date(eventStartDate)) {
      throw new ValidationError('Event End Date should be after Start Date. Please correct the dates.');
    }
    if (eventHasSponsorship === true) {
      const sponsors = Array.isArray(eventSponsors) ? eventSponsors : [];
      const validSponsors = sponsors.filter((s) => s && String(s.name || '').trim());
      if (validSponsors.length === 0) {
        throw new ValidationError('Please add at least one sponsor with a name when Sponsorship is enabled.');
      }
    }
    if (eventHasResources === true) {
      const resources = Array.isArray(eventResources) ? eventResources : [];
      const validResources = resources.filter((r) => r && (String(r.type || '').trim() || String(r.description || '').trim()));
      if (validResources.length === 0) {
        throw new ValidationError('Please add at least one resource with type or description when Resources are enabled.');
      }
    }
    if (eventDutyLeaveAvailable === true) {
      if (!eventDutyLeaveRoleType || !['participants', 'organizers', 'both'].includes(eventDutyLeaveRoleType)) {
        throw new ValidationError('Please select who is eligible for Duty Leave (Participants, Organizers, or Both) when Duty Leave is enabled.');
      }
    }
    if (notingEventType === 'stall' && stallConfig) {
      if (stallConfig.enableStudentApplied === true) {
        const maxStalls = stallConfig.maxStudentStalls;
        if (maxStalls == null || maxStalls === '' || Number(maxStalls) < 1) {
          throw new ValidationError('Please enter Max Student Stalls (minimum 1) when Student-Applied Stalls is enabled.');
        }
      }
      if (stallConfig.enableCreatorMade === true) {
        const creatorStalls = Array.isArray(stallConfig.creatorStalls) ? stallConfig.creatorStalls : [];
        for (let i = 0; i < creatorStalls.length; i++) {
          const name = String(creatorStalls[i]?.name || '').trim();
          if (!name) {
            throw new ValidationError(`Creator Stall #${i + 1}: Please enter a name for each creator-made stall.`);
          }
        }
      }
    }
    if (!eventPaymentType) throw new ValidationError('Please select Payment Type: Free or Paid.');
    if (eventPaymentType === 'paid') {
      const isTeam = eventParticipationType === 'team';
      if (isTeam && (eventRegistrationFeeTeam == null || eventRegistrationFeeTeam === '' || Number(eventRegistrationFeeTeam) < 1)) {
        throw new ValidationError('Participation fee must be at least ₹1.');
      }
      if (!isTeam && (eventRegistrationFeeIndividual == null || eventRegistrationFeeIndividual === '' || Number(eventRegistrationFeeIndividual) < 1)) {
        throw new ValidationError('Participation fee must be at least ₹1.');
      }
    }
  }

  if (notingEventType === 'festival') {
    const meta = note.festivalMeta || {};
    const subEvents = note.subEvents || [];
    if (!meta.name || !String(meta.name).trim()) throw new ValidationError('Please enter the Festival Name.');
    if (!meta.startDate) throw new ValidationError('Please select the Festival Start Date.');
    if (!meta.endDate) throw new ValidationError('Please select the Festival End Date.');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (meta.startDate && new Date(meta.startDate) < todayStart) {
      throw new ValidationError('Festival Start Date cannot be in the past. Please select a future date.');
    }
    if (meta.startDate && meta.endDate && new Date(meta.endDate) < new Date(meta.startDate)) {
      throw new ValidationError('Festival End Date should be after Start Date. Please correct the dates.');
    }
    if (subEvents.length === 0) throw new ValidationError('Please add at least one sub-event to the festival.');
    for (let i = 0; i < subEvents.length; i++) {
      const v = subEvents[i]?.venueFormData || subEvents[i] || {};
      const label = `Sub-Event #${i + 1}`;
      if (!v.eventName || !String(v.eventName).trim()) throw new ValidationError(`${label}: Please enter the Event Name.`);
      if (!v.eventType) throw new ValidationError(`${label}: Please select the Event Type.`);
      if (!v.eventStartDate) throw new ValidationError(`${label}: Please select the Start Date.`);
      if (!v.eventEndDate) throw new ValidationError(`${label}: Please select the End Date.`);
      const subTodayStart = new Date();
      subTodayStart.setHours(0, 0, 0, 0);
      if (v.eventStartDate && new Date(v.eventStartDate) < subTodayStart) {
        throw new ValidationError(`${label}: Start Date cannot be in the past. Please select a future date.`);
      }
      if (v.eventStartDate && v.eventEndDate && new Date(v.eventEndDate) < new Date(v.eventStartDate)) {
        throw new ValidationError(`${label}: End Date should be after Start Date. Please correct the dates.`);
      }
      if (v.eventHasSponsorship === true) {
        const sponsors = Array.isArray(v.eventSponsors) ? v.eventSponsors : [];
        const validSponsors = sponsors.filter((s) => s && String(s.name || '').trim());
        if (validSponsors.length === 0) throw new ValidationError(`${label}: Please add at least one sponsor with a name when Sponsorship is enabled.`);
      }
      if (v.eventHasResources === true) {
        const resources = Array.isArray(v.eventResources) ? v.eventResources : [];
        const validResources = resources.filter((r) => r && (String(r.type || '').trim() || String(r.description || '').trim()));
        if (validResources.length === 0) throw new ValidationError(`${label}: Please add at least one resource when Resources are enabled.`);
      }
      if (v.eventDutyLeaveAvailable === true) {
        if (!v.eventDutyLeaveRoleType || !['participants', 'organizers', 'both'].includes(v.eventDutyLeaveRoleType)) {
          throw new ValidationError(`${label}: Please select Duty Leave eligibility when Duty Leave is enabled.`);
        }
      }
      const subEvt = subEvents[i] || {};
      const sc = subEvt.stallConfig;
      if (subEvt.eventType === 'stall' && sc) {
        if (sc.enableStudentApplied === true && (sc.maxStudentStalls == null || sc.maxStudentStalls === '' || Number(sc.maxStudentStalls) < 1)) {
          throw new ValidationError(`${label}: Please enter Max Student Stalls (min 1) when Student-Applied Stalls is enabled.`);
        }
        if (sc.enableCreatorMade === true) {
          const creatorStalls = Array.isArray(sc.creatorStalls) ? sc.creatorStalls : [];
          for (let j = 0; j < creatorStalls.length; j++) {
            if (!String(creatorStalls[j]?.name || '').trim()) {
              throw new ValidationError(`${label}: Creator Stall #${j + 1} must have a name.`);
            }
          }
        }
      }
      if (!v.eventPaymentType) throw new ValidationError(`${label}: Please select Payment Type (Free or Paid).`);
      if (v.eventPaymentType === 'paid') {
        const isTeam = v.eventParticipationType === 'team';
        if (isTeam && (v.eventRegistrationFeeTeam == null || v.eventRegistrationFeeTeam === '' || Number(v.eventRegistrationFeeTeam) < 1)) {
          throw new ValidationError(`${label}: Participation fee must be at least ₹1.`);
        }
        if (!isTeam && (v.eventRegistrationFeeIndividual == null || v.eventRegistrationFeeIndividual === '' || Number(v.eventRegistrationFeeIndividual) < 1)) {
          throw new ValidationError(`${label}: Participation fee must be at least ₹1.`);
        }
      }
    }
  }
}

module.exports = {
  validateDescription,
  validateCategory,
  validateNoteForSubmission,
  sanitizeAttachments,
  sanitizePoints,
  parsePolicyCompliance,
  sanitizeEventSponsors,
};
