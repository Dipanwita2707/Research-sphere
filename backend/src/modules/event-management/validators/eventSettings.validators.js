/**
 * Event Settings Validators
 *
 * Input validation for event settings / visibility endpoints.
 */

const { ValidationError } = require('../../../shared/utils/AppError');

const VALID_ROLES = ['student', 'faculty', 'staff', 'admin', 'parent', 'superadmin'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate the updateEventSettings body
 */
const validateEventSettingsUpdate = (req, _res, next) => {
  const body = req.body;

  // isActive
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    throw new ValidationError('isActive must be a boolean');
  }

  // visibleToRoles
  if (body.visibleToRoles !== undefined) {
    if (!Array.isArray(body.visibleToRoles)) {
      throw new ValidationError('visibleToRoles must be an array');
    }
    const invalid = body.visibleToRoles.filter((r) => !VALID_ROLES.includes(r));
    if (invalid.length > 0) {
      throw new ValidationError(`Invalid roles: ${invalid.join(', ')}. Valid roles: ${VALID_ROLES.join(', ')}`);
    }
    if (body.visibleToRoles.length === 0) {
      throw new ValidationError('At least one visible role must be selected');
    }
  }

  // studentFilterType
  if (body.studentFilterType !== undefined) {
    if (!['all', 'custom'].includes(body.studentFilterType)) {
      throw new ValidationError('studentFilterType must be "all" or "custom"');
    }
  }

  // UUID array fields
  const uuidArrayFields = ['allowedSchoolIds', 'allowedDepartmentIds', 'allowedProgramIds', 'allowedSectionIds'];
  for (const field of uuidArrayFields) {
    if (body[field] !== undefined) {
      if (!Array.isArray(body[field])) {
        throw new ValidationError(`${field} must be an array`);
      }
      const invalid = body[field].filter((id) => !UUID_REGEX.test(id));
      if (invalid.length > 0) {
        throw new ValidationError(`${field} contains invalid UUID(s)`);
      }
    }
  }

  // allowedBatchYears
  if (body.allowedBatchYears !== undefined) {
    if (!Array.isArray(body.allowedBatchYears)) {
      throw new ValidationError('allowedBatchYears must be an array');
    }
    const invalid = body.allowedBatchYears.filter((y) => !Number.isInteger(Number(y)) || Number(y) < 2000 || Number(y) > 2100);
    if (invalid.length > 0) {
      throw new ValidationError('allowedBatchYears contains invalid year values');
    }
  }

  next();
};

module.exports = {
  validateEventSettingsUpdate,
};
