const { z } = require('zod');

/**
 * Employee Creation Validation Schema
 * Validates all required fields during employee creation
 */
const createEmployeeSchema = z.object({
  // Login details
  uid: z
    .string()
    .min(1, 'UID is required - Please enter a 4-5 digit number')
    .regex(/^\d{4,5}$/, 'UID must contain exactly 4-5 digits (e.g., 12555), no letters or special characters allowed'),
  
  email: z
    .string()
    .min(1, 'Email is required - Please enter a valid email address')
    .email('Email format is invalid - Use format: name@example.com'),
  
  password: z
    .string()
    .min(1, 'Password is required - Enter at least 8 characters')
    .min(8, 'Password must be at least 8 characters long (e.g., MyPass123)'),
  
  role: z
    .string()
    .min(1, 'Role is required - Please select Faculty or Staff')
    .refine(
      (val) => ['faculty', 'staff'].includes(val),
      'Role must be one of: Faculty or Staff'
    ),

  // Employee details
  empId: z
    .string()
    .min(1, 'Employee ID is required - Auto-filled from UID')
    .regex(/^\d{4,5}$/, 'Employee ID must contain exactly 4-5 digits, no letters allowed'),
  
  firstName: z
    .string()
    .min(1, 'First name is required - Please enter the first name')
    .min(2, 'First name must be at least 2 characters (e.g., John, Mary)')
    .max(50, 'First name exceeds 50 characters - Please shorten it')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name should only contain letters, spaces, hyphens (-) or apostrophes (\') - No numbers or special characters'),
  
  middleName: z
    .string()
    .max(50, 'Middle name must not exceed 50 characters')
    .regex(/^[a-zA-Z\s'-]*$/, 'Middle name can only contain letters, spaces, hyphens and apostrophes')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
  
  lastName: z
    .string()
    .max(50, 'Last name exceeds 50 characters - Please shorten it')
    .regex(/^[a-zA-Z\s'-]*$/, 'Last name should only contain letters, spaces, hyphens (-) or apostrophes (\') - No numbers or special characters')
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || val.length >= 2,
      'Last name must be at least 2 characters (e.g., Smith, Kumar)'
    ),
  
  gender: z
    .string()
    .min(1, 'Gender is required - Please select Male, Female, or Other')
    .refine(
      (val) => ['male', 'female', 'other'].includes(val.toLowerCase()),
      'Gender must be one of: Male, Female, or Other'
    ),
  
  mobileNumber: z
    .string()
    .min(1, 'Mobile number is required - Please enter a 10-digit phone number')
    .regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits with only numbers (e.g., 9876543210) - No spaces, dashes, or special characters'),

  // Optional fields
  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Date of birth must be in YYYY-MM-DD format'
    ),
  
  alternateNumber: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Alternate number must be exactly 10 digits (numbers only)'
    ),
  
  personalEmail: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null))
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Personal email format is invalid - Use format: name@example.com'
    ),
  
  // Professional details
  designation: z
    .string()
    .min(1, 'Designation is required - Please enter designation (e.g., Professor, Assistant Professor)'),
  
  officerLevel: z
    .string()
    .optional()
    .or(z.literal('')),
  
  employeeCategory: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['teaching', 'non_teaching'].includes(val),
      'Employee category must be either Teaching or Non-Teaching'
    ),
  
  employeeType: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['permanent', 'temporary', 'contract'].includes(val),
      'Employee type must be Permanent, Temporary, or Contract'
    ),
  
  dateOfJoining: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Date of joining must be in YYYY-MM-DD format'
    ),
  
  schoolId: z
    .string()
    .optional()
    .or(z.literal(null)),
  
  departmentId: z
    .string()
    .optional()
    .or(z.literal(null)),
  
  primaryCentralDeptId: z
    .string()
    .optional()
    .or(z.literal(null)),
  
  // Address
  currentAddress: z
    .string()
    .max(500, 'Current address must not exceed 500 characters')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
  
  permanentAddress: z
    .string()
    .max(500, 'Permanent address must not exceed 500 characters')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
  
  // Other
  isActive: z
    .boolean()
    .optional()
    .default(true),

  // Researcher IDs (admin-managed, seeded at creation)
  scopusAuthorId: z
    .string()
    .max(64, 'Scopus Author ID must not exceed 64 characters')
    .regex(/^[A-Za-z0-9\-]*$/, 'Scopus Author ID can only contain letters, digits, and hyphens')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),

  orcid: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null))
    .refine(
      (val) => !val || /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(val),
      'ORCID must be in the format XXXX-XXXX-XXXX-XXXX (e.g., 0000-0002-1825-0097)'
    ),

  pubmedId: z
    .string()
    .max(64, 'PubMed ID must not exceed 64 characters')
    .regex(/^[A-Za-z0-9\-]*$/, 'PubMed ID can only contain letters, digits, and hyphens')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
});

/**
 * Employee Update Validation Schema
 * For updating employee (UID cannot be changed)
 */
const updateEmployeeSchema = z.object({
  email: z
    .string()
    .email('Email format is invalid - Use format: name@example.com')
    .optional()
    .or(z.literal('')),

  role: z
    .string()
    .optional()
    .refine(
      (val) => !val || ['faculty', 'staff'].includes(val),
      'Role must be one of: Faculty or Staff'
    ),
  
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
    .or(z.literal(''))
    .refine(
      (val) => !val || val.length >= 2,
      'Last name must be at least 2 characters'
    ),
  
  gender: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['male', 'female', 'other'].includes(val.toLowerCase()),
      'Gender must be one of: Male, Female, or Other'
    ),
  
  mobileNumber: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Mobile number must be exactly 10 digits (numbers only)'
    ),
  
  designation: z
    .string()
    .min(1, 'Designation is required'),
  
  officerLevel: z
    .string()
    .optional()
    .or(z.literal('')),
  
  employeeCategory: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['teaching', 'non_teaching'].includes(val),
      'Employee category must be either Teaching or Non-Teaching'
    ),
  
  employeeType: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || ['permanent', 'temporary', 'contract'].includes(val),
      'Employee type must be Permanent, Temporary, or Contract'
    ),
  
  dateOfJoining: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Date of joining must be in YYYY-MM-DD format'
    ),
  
  schoolId: z
    .string()
    .optional()
    .or(z.literal(null)),
  
  departmentId: z
    .string()
    .optional()
    .or(z.literal(null)),
  
  primaryCentralDeptId: z
    .string()
    .optional()
    .or(z.literal(null)),

  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Date of birth must be in YYYY-MM-DD format'
    ),

  alternateNumber: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^\d{10}$/.test(val),
      'Alternate number must be exactly 10 digits (numbers only)'
    ),

  personalEmail: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Personal email format is invalid - Use format: name@example.com'
    ),

  currentAddress: z
    .string()
    .max(500, 'Current address must not exceed 500 characters')
    .optional()
    .or(z.literal('')),

  permanentAddress: z
    .string()
    .max(500, 'Permanent address must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
  
  isActive: z
    .boolean()
    .optional(),

  // Researcher IDs (admin-managed only — not editable by user)
  scopusAuthorId: z
    .string()
    .max(64, 'Scopus Author ID must not exceed 64 characters')
    .regex(/^[A-Za-z0-9\-]*$/, 'Scopus Author ID can only contain letters, digits, and hyphens')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),

  orcid: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null))
    .refine(
      (val) => !val || /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(val),
      'ORCID must be in the format XXXX-XXXX-XXXX-XXXX (e.g., 0000-0002-1825-0097)'
    ),

  pubmedId: z
    .string()
    .max(64, 'PubMed ID must not exceed 64 characters')
    .regex(/^[A-Za-z0-9\-]*$/, 'PubMed ID can only contain letters, digits, and hyphens')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
}).strip(); // Strip unknown fields silently

/**
 * Validate create employee data
 * @param {object} data - The form data to validate
 * @returns {object} - Result with success flag and errors if any
 */
const validateCreateEmployee = (data) => {
  try {
    const validated = createEmployeeSchema.parse(data);
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
 * Validate update employee data
 * @param {object} data - The form data to validate
 * @returns {object} - Result with success flag and errors if any
 */
const validateUpdateEmployee = (data) => {
  try {
    const validated = updateEmployeeSchema.parse(data);
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

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  validateCreateEmployee,
  validateUpdateEmployee,
};
