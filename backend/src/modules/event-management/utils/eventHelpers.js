/**
 * Event Management Helper Functions
 */

const { NotFoundError, ValidationError } = require('../../../shared/utils/AppError');
const { ERRORS } = require('../constants/event.constants');
const { generateQRCode } = require('./qrCodeGenerator');

/**
 * Generate unique Event ID
 * Format: EVT-YYYY-XXXX
 */
const generateEventId = async (prisma) => {
  const year = new Date().getFullYear();
  const prefix = `EVT-${year}-`;
  
  // Get the last event ID for this year
  const lastEvent = await prisma.event.findFirst({
    where: {
      eventId: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      eventId: true,
    },
  });
  
  let sequence = 1;
  if (lastEvent) {
    const lastSequence = parseInt(lastEvent.eventId.split('-')[2]);
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

/**
 * Generate unique Registration ID
 * Format: REG-EVENTID-XXXX
 */
const generateRegistrationId = async (prisma, eventId) => {
  const prefix = `REG-${eventId}-`;
  
  // Get count of registrations for this event
  const count = await prisma.eventRegistration.count({
    where: { eventId },
  });
  
  const sequence = count + 1;
  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

/**
 * Validate event exists and return it with related data
 */
const getEventById = async (prisma, eventId, include = {}) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      note: {
        select: {
          notingId: true,
          status: true,
          category: true,
          subcategory: true,
        },
      },
      ...include,
    },
  });
  
  if (!event) {
    throw new NotFoundError(ERRORS.EVENT_NOT_FOUND);
  }
  
  return event;
};

/**
 * Check if user can register for event
 */
const canRegisterForEvent = async (prisma, event, userId) => {
  // Check if event is published
  if (event.status !== 'published') {
    throw new ValidationError(ERRORS.EVENT_NOT_PUBLISHED);
  }
  
  // Check registration dates
  const now = new Date();
  if (event.registrationStartDate && now < event.registrationStartDate) {
    throw new ValidationError('Registration has not started yet');
  }
  if (event.registrationEndDate && now > event.registrationEndDate) {
    throw new ValidationError(ERRORS.REGISTRATION_CLOSED);
  }
  
  // Check if already registered
  const existingRegistration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: event.id,
      userId,
    },
  });
  
  if (existingRegistration) {
    throw new ValidationError(ERRORS.ALREADY_REGISTERED);
  }
  
  // Check capacity
  if (event.maxCapacity && event.currentRegistrations >= event.maxCapacity) {
    throw new ValidationError(ERRORS.EVENT_FULL);
  }
  
  return true;
};

/**
 * Check if user is a volunteer for the event
 */
const isEventVolunteer = async (prisma, eventId, userId) => {
  const volunteer = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId,
      canScanQr: true,
    },
  });
  
  return !!volunteer;
};

/**
 * Validate QR code and get registration
 */
const validateQRCodeAndGetRegistration = async (prisma, qrCode, eventId) => {
  const registration = await prisma.eventRegistration.findFirst({
    where: {
      qrCode,
      eventId,
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              registrationNo: true,
              studentId: true,
            },
          },
        },
      },
      event: {
        select: {
          id: true,
          eventId: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });
  
  if (!registration) {
    throw new NotFoundError(ERRORS.INVALID_QR_CODE);
  }
  
  if (registration.status !== 'confirmed') {
    throw new ValidationError('Registration is not confirmed');
  }
  
  return registration;
};

/**
 * Format event for API response
 */
const formatEventResponse = (event) => {
  return {
    id: event.id,
    eventId: event.eventId,
    name: event.name,
    eventType: event.eventType,
    description: event.description,
    longDescription: event.longDescription,
    startDate: event.startDate,
    endDate: event.endDate,
    paymentType: event.paymentType,
    registrationFee: event.registrationFee,
    status: event.status,
    venue: event.venue,
    maxCapacity: event.maxCapacity,
    currentRegistrations: event.currentRegistrations,
    isPaid: event.isPaid,
    registrationStartDate: event.registrationStartDate,
    registrationEndDate: event.registrationEndDate,
    publishedAt: event.publishedAt,
    // Event Branding
    bannerImageUrl: event.bannerImageUrl,
    logoImageUrl: event.logoImageUrl,
    // Opportunity Mode & Participation
    opportunityMode: event.opportunityMode,
    participationType: event.participationType,
    minTeamSize: event.minTeamSize,
    maxTeamSize: event.maxTeamSize,
    interCollegeAllowed: event.interCollegeAllowed,
    interSpecializationAllowed: event.interSpecializationAllowed,
    // Contact Details
    contactPersonName: event.contactPersonName,
    contactEmail: event.contactEmail,
    contactMobile: event.contactMobile,
    alternateContact: event.alternateContact,
    websiteUrl: event.websiteUrl,
    socialMediaLinks: event.socialMediaLinks,
    // Additional Information
    eligibilityCriteria: event.eligibilityCriteria,
    rulesAndGuidelines: event.rulesAndGuidelines,
    prizeDetails: event.prizeDetails,
    certificateAvailable: event.certificateAvailable,
    faqs: event.faqs,
    // Metadata
    notingId: event.notingId,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    createdBy: event.user_login ? {
      id: event.user_login.id,
      uid: event.user_login.uid,
      email: event.user_login.email,
      name: event.user_login.employeeDetails?.displayName || 
            `${event.user_login.employeeDetails?.firstName || ''} ${event.user_login.employeeDetails?.lastName || ''}`.trim(),
    } : null,
    note: event.note ? {
      notingId: event.note.notingId,
      status: event.note.status,
      category: event.note.category,
      subcategory: event.note.subcategory,
    } : null,
    userRegistration: event.userRegistration || null,
  };
};

module.exports = {
  generateEventId,
  generateRegistrationId,
  getEventById,
  canRegisterForEvent,
  isEventVolunteer,
  validateQRCodeAndGetRegistration,
  formatEventResponse,
};
