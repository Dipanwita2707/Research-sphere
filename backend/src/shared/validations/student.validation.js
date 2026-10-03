const { z } = require('zod');

/** Optional YYYY-MM-DD date that is a real calendar date ('' / null = not set). */
const phdDateField = (label) => z
  .string()
  .optional()
  .or(z.literal(''))
  .or(z.literal(null))
  .refine(
    (val) => {
      if (!val) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
      const d = new Date(`${val}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
    },
    `${label} must be a valid date in YYYY-MM-DD format`
  );

/**
 * Student Creation Validation Schema
 */
const createStudentSchema = z.object({
  // Required fields
  studentId: z
    .string()
    .min(1, 'Student ID is required - Please enter a 9-10 digit registration number')
    .regex(/^\d{9,10}$/, 'Student ID must contain exactly 9-10 digits (e.g., 2024001234), no letters or special characters allowed'),

  registrationNo: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || val.length >= 2,
      'Registration number must be at least 2 characters when provided'
    ),

  firstName: z
    .string()
    .min(1, 'First name is required - Please enter the student\'s first name')
    .min(2, 'First name must be at least 2 characters (e.g., John, Sarah)')
    .max(50, 'First name exceeds 50 characters - Please shorten it')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name should only contain letters, spaces, hyphens (-) or apostrophes (\') - No numbers or special characters'),

  middleName: z
    .string()
    .max(50, 'Middle name must be 50 characters or fewer')
    .regex(/^[a-zA-Z\s'-]*$/, 'Middle name should only contain letters, spaces, hyphens (-) or apostrophes (\')')
    .optional()
    .or(z.literal('')),

  lastName: z
    .string()
    .max(50, 'Last name must be 50 characters or fewer')
    .regex(/^[a-zA-Z\s'-]*$/, 'Last name should only contain letters, spaces, hyphens (-) or apostrophes (\')')
    .optional()
    .or(z.literal('')),

  email: z
    .string()
    .min(1, 'Email is required - Please enter a valid email address')
    .email('Email format is invalid - Use format: name@example.com'),

  phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Phone must be exactly 10 digits (e.g., 9876543210) - No spaces, dashes, or letters allowed'
    ),

  password: z
    .string()
    .min(1, 'Password is required for new students - Enter at least 8 characters')
    .min(8, 'Password must be at least 8 characters long (e.g., MyPass123)')
    .optional()
    .or(z.literal('')),

  programId: z
    .string()
    .min(1, 'Program is required - Please select a program from the dropdown'),

  sectionId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),

  mentorId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),

  currentSemester: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d+$/.test(val),
      'Current semester must be a valid number'
    ),

  // Optional fields with validation
  admissionDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Admission date must be in YYYY-MM-DD format'
    ),

  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Date of birth must be in YYYY-MM-DD format'
    ),

  gender: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['male', 'female', 'other'].includes(val.toLowerCase()),
      'Gender must be one of: Male, Female, or Other'
    ),

  bloodGroup: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].includes(val),
      'Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-'
    ),

  parentContact: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Parent contact must be exactly 10 digits when provided'
    ),

  emergencyContact: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Emergency contact must be exactly 10 digits when provided'
    ),

  address: z
    .string()
    .max(500, 'Address must be 500 characters or fewer')
    .optional()
    .or(z.literal('')),
  // PhD (doctoral programmes only; NIRF PhD registered / awarded)
  phdRegistrationDate: phdDateField('PhD registration date'),
  phdAwardedAt: phdDateField('PhD awarded date'),
  thesisTitle: z
    .string()
    .max(512, 'Thesis title must be 512 characters or fewer')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
});

/**
 * Student Update Validation Schema
 */
const updateStudentSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be 50 characters or fewer')
    .regex(/^[a-zA-Z\s'-]*$/, 'First name should only contain letters, spaces, hyphens (-) or apostrophes (\')')
    .optional()
    .or(z.literal('')),

  middleName: z
    .string()
    .max(50, 'Middle name must be 50 characters or fewer')
    .regex(/^[a-zA-Z\s'-]*$/, 'Middle name should only contain letters, spaces, hyphens (-) or apostrophes (\')')
    .optional()
    .or(z.literal('')),

  lastName: z
    .string()
    .max(50, 'Last name must be 50 characters or fewer')
    .regex(/^[a-zA-Z\s'-]*$/, 'Last name should only contain letters, spaces, hyphens (-) or apostrophes (\')')
    .optional()
    .or(z.literal('')),

  email: z
    .string()
    .email('Email format is invalid - Use format: name@example.com')
    .optional()
    .or(z.literal('')),

  phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Phone must be exactly 10 digits (e.g., 9876543210), numbers only'
    ),

  programId: z
    .string()
    .optional()
    .or(z.literal('')),

  sectionId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),

  mentorId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),

  currentSemester: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d+$/.test(val),
      'Current semester must be a valid number'
    ),

  admissionDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Admission date must be in YYYY-MM-DD format'
    ),

  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Date of birth must be in YYYY-MM-DD format'
    ),

  gender: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['male', 'female', 'other'].includes(val.toLowerCase()),
      'Gender must be one of: Male, Female, or Other'
    ),

  bloodGroup: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].includes(val),
      'Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-'
    ),

  parentContact: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Parent contact must be exactly 10 digits when provided'
    ),

  emergencyContact: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Emergency contact must be exactly 10 digits when provided'
    ),

  address: z
    .string()
    .max(500, 'Address must be 500 characters or fewer')
    .optional()
    .or(z.literal('')),
  // PhD (doctoral programmes only; NIRF PhD registered / awarded)
  phdRegistrationDate: phdDateField('PhD registration date'),
  phdAwardedAt: phdDateField('PhD awarded date'),
  thesisTitle: z
    .string()
    .max(512, 'Thesis title must be 512 characters or fewer')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
}).strict();

/**
 * Validate create student data
 */
const validateCreateStudent = (data) => {
  try {
    const validated = createStudentSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = {};
      (error.issues || []).forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, data: null, errors };
    }
    return {
      success: false,
      data: null,
      errors: { general: 'Validation failed' },
    };
  }
};

/**
 * Validate update student data
 */
const validateUpdateStudent = (data) => {
  try {
    const validated = updateStudentSchema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = {};
      (error.issues || []).forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, data: null, errors };
    }
    return {
      success: false,
      data: null,
      errors: { general: 'Validation failed' },
    };
  }
};

/**
 * PhD fields of a student (doctoral programmes): dates are YYYY-MM-DD, the award cannot precede the
 * registration, and neither may be in the future. `existing` supplies the stored values for fields
 * the request leaves out, so a partial update is checked against the full record.
 * @returns {{ success: boolean, data: object|null, errors: object|null }}
 *   data: { phdRegistrationDate?: Date|null, phdAwardedAt?: Date|null, thesisTitle?: string|null }
 *         (only the keys that were sent)
 */
const validateStudentPhdFields = (input = {}, existing = {}, now = new Date()) => {
  const errors = {};
  const data = {};
  const today = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const toIso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const effective = {};

  for (const [key, label] of [['phdRegistrationDate', 'PhD registration date'], ['phdAwardedAt', 'PhD awarded date']]) {
    if (input[key] === undefined) {
      effective[key] = toIso(existing[key]);
      continue;
    }
    const parsed = phdDateField(label).safeParse(input[key]);
    if (!parsed.success) {
      errors[key] = parsed.error.issues[0].message;
      continue;
    }
    const val = input[key] || null;
    if (val && val > today) {
      errors[key] = `${label} cannot be in the future`;
      continue;
    }
    data[key] = val ? new Date(`${val}T00:00:00Z`) : null;
    effective[key] = val;
  }

  if (input.thesisTitle !== undefined) {
    if (input.thesisTitle !== null && typeof input.thesisTitle !== 'string') errors.thesisTitle = 'Thesis title must be text';
    else if (input.thesisTitle && input.thesisTitle.trim().length > 512) errors.thesisTitle = 'Thesis title must be 512 characters or fewer';
    else data.thesisTitle = input.thesisTitle ? input.thesisTitle.trim() : null;
  }

  if (!errors.phdRegistrationDate && !errors.phdAwardedAt && effective.phdAwardedAt) {
    if (!effective.phdRegistrationDate) {
      errors.phdRegistrationDate = 'PhD registration date is required when an award date is set';
    } else if (effective.phdAwardedAt < effective.phdRegistrationDate) {
      errors.phdAwardedAt = 'PhD awarded date cannot be before the registration date';
    }
  }

  return Object.keys(errors).length ? { success: false, data: null, errors } : { success: true, data, errors: null };
};

/** True when any PhD field carries a value (used to reject PhD data on non-doctoral programmes). */
const hasPhdValues = (data = {}) => Boolean(data.phdRegistrationDate || data.phdAwardedAt || data.thesisTitle);

module.exports = {
  validateStudentPhdFields,
  hasPhdValues,
  createStudentSchema,
  updateStudentSchema,
  validateCreateStudent,
  validateUpdateStudent,
};
