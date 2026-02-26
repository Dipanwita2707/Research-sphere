/**
 * Event Custom Field Service
 * 
 * Handles custom field management for event organizers
 */

const prisma = require('../../../shared/config/database');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');

const FIELD_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime',
  DROPDOWN: 'dropdown',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  FILE: 'file',
  IMAGE: 'image',
};

/**
 * Get custom fields for an event
 */
const getCustomFields = async (eventId) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const fields = await prisma.eventCustomField.findMany({
    where: {
      eventId: event.id,
    },
    orderBy: { sortOrder: 'asc' },
  });

  return fields;
};

/**
 * Create a custom field
 */
const createCustomField = async (eventId, userId, fieldData) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Verify user is event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can manage custom fields');
  }

  // Validate field type
  const validFieldTypes = Object.values(FIELD_TYPES);
  if (!validFieldTypes.includes(fieldData.fieldType)) {
    throw new ValidationError(`Invalid field type. Must be one of: ${validFieldTypes.join(', ')}`);
  }

  // Validate options for dropdown/radio/checkbox
  if (['dropdown', 'radio', 'checkbox'].includes(fieldData.fieldType)) {
    if (!fieldData.options || !Array.isArray(fieldData.options) || fieldData.options.length === 0) {
      throw new ValidationError('Options are required for dropdown/radio/checkbox fields');
    }
  }

  // Generate field name from label
  const fieldName = fieldData.fieldName || 
    fieldData.fieldLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

  // Check for duplicate field name
  const existingField = await prisma.eventCustomField.findFirst({
    where: {
      eventId: event.id,
      fieldName: fieldName,
    },
  });

  if (existingField) {
    throw new ValidationError('A field with this name already exists');
  }

  // Get max sort order
  const maxOrder = await prisma.eventCustomField.aggregate({
    where: { eventId: event.id },
    _max: { sortOrder: true },
  });

  const field = await prisma.eventCustomField.create({
    data: {
      eventId: event.id,
      fieldName: fieldName,
      fieldLabel: fieldData.fieldLabel,
      fieldType: fieldData.fieldType,
      isRequired: fieldData.isRequired || false,
      placeholder: fieldData.placeholder,
      helpText: fieldData.helpText,
      options: fieldData.options,
      validationRules: fieldData.validationRules,
      defaultValue: fieldData.defaultValue,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1,
      isActive: true,
    },
  });

  return field;
};

/**
 * Update a custom field
 */
const updateCustomField = async (fieldId, userId, fieldData) => {
  const field = await prisma.eventCustomField.findUnique({
    where: { id: fieldId },
    include: { Event: true },
  });

  if (!field) {
    throw new NotFoundError('Field not found');
  }

  // Verify user is event creator
  if (field.Event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can manage custom fields');
  }

  // Check if field has responses (then we can only change limited things)
  const hasResponses = await prisma.eventFieldResponse.findFirst({
    where: { fieldId: fieldId },
  });

  if (hasResponses) {
    // Only allow changing label, helpText, isRequired, isActive
    const allowedUpdates = ['fieldLabel', 'helpText', 'isRequired', 'isActive', 'sortOrder'];
    const updateData = {};
    
    for (const key of allowedUpdates) {
      if (fieldData[key] !== undefined) {
        updateData[key] = fieldData[key];
      }
    }

    const updatedField = await prisma.eventCustomField.update({
      where: { id: fieldId },
      data: updateData,
    });

    return updatedField;
  }

  // Field has no responses, can update everything
  const updatedField = await prisma.eventCustomField.update({
    where: { id: fieldId },
    data: {
      fieldLabel: fieldData.fieldLabel,
      fieldType: fieldData.fieldType,
      isRequired: fieldData.isRequired,
      placeholder: fieldData.placeholder,
      helpText: fieldData.helpText,
      options: fieldData.options,
      validationRules: fieldData.validationRules,
      defaultValue: fieldData.defaultValue,
      sortOrder: fieldData.sortOrder,
      isActive: fieldData.isActive,
    },
  });

  return updatedField;
};

/**
 * Delete a custom field
 */
const deleteCustomField = async (fieldId, userId) => {
  const field = await prisma.eventCustomField.findUnique({
    where: { id: fieldId },
    include: { Event: true },
  });

  if (!field) {
    throw new NotFoundError('Field not found');
  }

  // Verify user is event creator
  if (field.Event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can manage custom fields');
  }

  // Check if field has responses
  const hasResponses = await prisma.eventFieldResponse.findFirst({
    where: { fieldId: fieldId },
  });

  if (hasResponses) {
    // Soft delete - mark as inactive
    await prisma.eventCustomField.update({
      where: { id: fieldId },
      data: { isActive: false },
    });
    return { message: 'Field deactivated (has existing responses)' };
  }

  // Hard delete
  await prisma.eventCustomField.delete({
    where: { id: fieldId },
  });

  return { message: 'Field deleted successfully' };
};

/**
 * Reorder custom fields
 */
const reorderCustomFields = async (eventId, userId, fieldOrderMap) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Verify user is event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can manage custom fields');
  }

  // Update sort order for each field
  const updates = Object.entries(fieldOrderMap).map(([fieldId, sortOrder]) => 
    prisma.eventCustomField.update({
      where: { id: fieldId },
      data: { sortOrder },
    })
  );

  await prisma.$transaction(updates);

  return { message: 'Fields reordered successfully' };
};

/**
 * Update event registration settings
 */
const updateRegistrationSettings = async (eventId, userId, settings) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Verify user is event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can update registration settings');
  }

  // Validate team settings
  if (settings.participationType === 'team') {
    if (!settings.minTeamSize || settings.minTeamSize < 1) {
      throw new ValidationError('Minimum team size must be at least 1');
    }
    if (settings.maxTeamSize && settings.maxTeamSize < settings.minTeamSize) {
      throw new ValidationError('Maximum team size must be greater than or equal to minimum');
    }
  }

  const updatedEvent = await prisma.event.update({
    where: { id: event.id },
    data: {
      participationType: settings.participationType,
      minTeamSize: settings.minTeamSize,
      maxTeamSize: settings.maxTeamSize,
      interCollegeAllowed: settings.interCollegeAllowed,
      maxTeamLimit: settings.maxTeamLimit,
      teamRegistrationDeadline: settings.teamRegistrationDeadline 
        ? new Date(settings.teamRegistrationDeadline) 
        : null,
      requireFormSubmission: settings.requireFormSubmission,
      lookingForTeammatesEnabled: settings.lookingForTeammatesEnabled,
      updatedAt: new Date(),
    },
  });

  return updatedEvent;
};

/**
 * Get event registration settings
 */
const getRegistrationSettings = async (eventId) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
    select: {
      id: true,
      eventId: true,
      name: true,
      participationType: true,
      minTeamSize: true,
      maxTeamSize: true,
      interCollegeAllowed: true,
      maxTeamLimit: true,
      teamRegistrationDeadline: true,
      requireFormSubmission: true,
      lookingForTeammatesEnabled: true,
      registrationStartDate: true,
      registrationEndDate: true,
      maxCapacity: true,
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  return event;
};

module.exports = {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
  updateRegistrationSettings,
  getRegistrationSettings,
  FIELD_TYPES,
};
