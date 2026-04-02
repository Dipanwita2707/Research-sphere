import { z } from 'zod';

/**
 * Frontend Employee Creation Validation Schema
 * Validates all required fields during employee creation
 */
export const createEmployeeSchema = z.object({
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
    .or(z.literal('')),

  lastName: z
    .string()
    .min(1, 'Last name is required - Please enter the last name')
    .min(2, 'Last name must be at least 2 characters (e.g., Smith, Kumar)')
    .max(50, 'Last name exceeds 50 characters - Please shorten it')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name should only contain letters, spaces, hyphens (-) or apostrophes (\') - No numbers or special characters'),

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

  // Professional details
  designation: z
    .string()
    .optional()
    .or(z.literal('')),

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
    .or(z.literal(''))
    .or(z.literal(null) as any),

  departmentId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null) as any),

  centralDepartmentId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null) as any),

  // Address
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

  // Other
  isActive: z
    .boolean()
    .optional()
    .default(true),
});

/**
 * Employee Update Validation Schema
 * For updating employee (UID cannot be changed)
 */
export const updateEmployeeSchema = z.object({
  email: z
    .string()
    .email('Email format is invalid - Use format: name@example.com')
    .optional()
    .or(z.literal('')),

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
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be 50 characters or fewer')
    .regex(/^[a-zA-Z\s'-]*$/, 'Last name should only contain letters, spaces, hyphens (-) or apostrophes (\')')
    .optional()
    .or(z.literal('')),

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
    .optional()
    .or(z.literal('')),

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
    .or(z.literal(''))
    .or(z.literal(null) as any),

  departmentId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null) as any),

  centralDepartmentId: z
    .string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null) as any),

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
});

export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeFormData = z.infer<typeof updateEmployeeSchema>;

/**
 * Validate create employee data
 */
export const validateCreateEmployee = (data: any) => {
  const result = createEmployeeSchema.safeParse(data);
  return result;
};

/**
 * Validate update employee data
 */
export const validateUpdateEmployee = (data: any) => {
  const result = updateEmployeeSchema.safeParse(data);
  return result;
};
