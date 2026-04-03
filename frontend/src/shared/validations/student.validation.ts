import { z } from 'zod';

/**
 * Student Creation Validation Schema
 */
export const createStudentSchema = z.object({
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
      'Phone must be exactly 10 digits (e.g., 9876543210), numbers only'
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
});

/**
 * Student Update Validation Schema
 */
export const updateStudentSchema = z.object({
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
});

export type CreateStudentFormData = z.infer<typeof createStudentSchema>;
export type UpdateStudentFormData = z.infer<typeof updateStudentSchema>;

/**
 * Validate create student data
 */
export const validateCreateStudent = (data: any) => {
  const result = createStudentSchema.safeParse(data);
  return result;
};

/**
 * Validate update student data
 */
export const validateUpdateStudent = (data: any) => {
  const result = updateStudentSchema.safeParse(data);
  return result;
};
