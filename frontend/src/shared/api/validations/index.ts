import { z } from 'zod';

/**
 * Common validation schemas for forms across the application
 */

// =====================================
  // Common Field Schemas
// ==============================
  export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z.string()
  .regex(/^[+]?[\d\s-]{10,15}$/, 'Invalid phone number')
  .optional()
  .or(z.literal(''));

export const urlSchema = z.string().url('Invalid URL').optional().or(z.literal(''));

export const requiredString = z.string().min(1, 'This field is required');

export const optionalString = z.string().optional().or(z.literal(''));

// =====================================
  // Auth & Profile Schemas
// ==============================
  export const loginSchema = z.object({
  uid: z.string().min(1, 'User ID is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword ===
   data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: optionalString,
  phone: phoneSchema,
  address: optionalString,
});

// =====================================
  // IPR Application Schemas
// ==============================
  export const iprTypeSchema = z.enum(['patent', 'copyright', 'trademark', 'design']);

export const projectTypeSchema = z.enum([
  'phd',
  'pg_project', 
  'ug_project',
  'faculty_research',
  'industry_collaboration',
  'any_other'
]);

export const filingTypeSchema = z.enum(['provisional', 'complete']);

export const iprInventorSchema = z.object({
  uid: optionalString,
  name: requiredString,
  email: emailSchema.optional().or(z.literal('')),
  department: optionalString,
  role: z.enum(['main_inventor', 'co_inventor']).optional(),
  contributionPercentage: z.number().min(0).max(100).optional(),
});

export const iprApplicationSchema = z.object({
  title: requiredString.describe('Title of the invention/creation'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  iprType: iprTypeSchema,
  projectType: projectTypeSchema,
  filingType: filingTypeSchema.optional(),
  inventors: z.array(iprInventorSchema).min(1, 'At least one inventor is required'),
  keywords: z.array(z.string()).optional(),
  noveltyStatement: optionalString,
  priorArt: optionalString,
});

// =====================================
  // Research Contribution Schemas
// ==============================
  export const publicationTypeSchema = z.enum([
  'research_paper',
  'book',
  'book_chapter', 
  'conference_paper'
]);

export const indexingTypeSchema = z.enum([
  'scopus',
  'wos',
  'pubmed',
  'ieee',
  'other'
]);

export const quartileSchema = z.enum(['Q1', 'Q2', 'Q3', 'Q4']).nullable().optional();

export const authorRoleSchema = z.enum([
  'first_author',
  'corresponding_author',
  'co_author',
  'senior_author'
]);

export const authorTypeSchema = z.enum([
  'internal_faculty',
  'internal_student',
  'external_academic',
  'external_industry',
  'external_other'
]);

export const researchAuthorSchema = z.object({
  uid: optionalString,
  name: requiredString,
  email: emailSchema.optional().or(z.literal('')),
  authorType: authorTypeSchema,
  role: authorRoleSchema,
  affiliation: optionalString,
  position: z.number().min(1).optional(),
});

export const researchPaperSchema = z.object({
  title: requiredString,
  abstract: z.string().min(100, 'Abstract must be at least 100 characters').optional(),
  journalName: requiredString.describe('Name of the journal'),
  publicationType: publicationTypeSchema,
  indexingType: indexingTypeSchema.optional(),
  quartile: quartileSchema,
  impactFactor: z.number().positive().optional(),
  doi: optionalString,
  issn: optionalString,
  volume: optionalString,
  issue: optionalString,
  pageNumbers: optionalString,
  publicationDate: z.string().optional(),
  coAuthors: z.array(researchAuthorSchema).optional(),
});

export const bookPublicationSchema = z.object({
  title: requiredString,
  publisherName: requiredString,
  isbn: z.string().regex(/^(?:\d{10}|\d{13})$/, 'Invalid ISBN format').optional().or(z.literal('')),
  publicationDate: z.string().optional(),
  nationalInternational: z.enum(['national', 'international']).optional(),
  bookPublicationType: z.enum(['authored', 'edited']).optional(),
  coAuthors: z.array(researchAuthorSchema).optional(),
});

export const bookChapterSchema = z.object({
  title: requiredString,
  bookTitle: requiredString,
  chapterNumber: optionalString,
  editors: optionalString,
  publisherName: requiredString,
  isbn: optionalString,
  pageNumbers: optionalString,
  publicationDate: z.string().optional(),
  coAuthors: z.array(researchAuthorSchema).optional(),
});

export const conferencePaperSchema = z.object({
  title: requiredString,
  conferenceName: requiredString,
  conferenceLocation: optionalString,
  conferenceDate: z.string().optional(),
  indexingType: indexingTypeSchema.optional(),
  quartile: quartileSchema,
  doi: optionalString,
  pageNumbers: optionalString,
  coAuthors: z.array(researchAuthorSchema).optional(),
});

// =====================================
  // Grant Application Schemas
// ==============================
  export const grantCategorySchema = z.enum([
  'sponsored_project',
  'consultancy_project', 
  'seed_money'
]);

export const grantProjectTypeSchema = z.enum([
  'international_collaboration',
  'national_project'
]);

export const fundingAgencySchema = z.enum([
  'dst',
  'dbt',
  'anrf',
  'csir',
  'icssr',
  'other'
]);

export const investigatorRoleSchema = z.enum([
  'principal_investigator',
  'co_principal_investigator',
  'co_investigator'
]);

export const investigatorSchema = z.object({
  uid: optionalString,
  name: requiredString,
  email: emailSchema.optional().or(z.literal('')),
  role: investigatorRoleSchema,
  department: optionalString,
  contributionPercentage: z.number().min(0).max(100).optional(),
});

export const grantApplicationSchema = z.object({
  title: requiredString.describe('Project title'),
  projectCategory: grantCategorySchema,
  projectType: grantProjectTypeSchema,
  fundingAgency: fundingAgencySchema,
  otherFundingAgency: optionalString,
  projectDuration: z.number().min(1).max(120).describe('Duration in months'),
  requestedAmount: z.number().positive('Amount must be greater than 0'),
  abstract: z.string().min(100, 'Abstract must be at least 100 characters'),
  objectives: z.string().min(50, 'Objectives must be at least 50 characters'),
  investigators: z.array(investigatorSchema).min(1, 'At least one investigator is required'),
  sdgGoals: z.array(z.string()).optional(),
});

// =====================================
  // Type exports
// ==============================
  export type LoginFormData = z.infer<typeof loginSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
export type IprApplicationFormData = z.infer<typeof iprApplicationSchema>;
export type ResearchPaperFormData = z.infer<typeof researchPaperSchema>;
export type BookPublicationFormData = z.infer<typeof bookPublicationSchema>;
export type BookChapterFormData = z.infer<typeof bookChapterSchema>;
export type ConferencePaperFormData = z.infer<typeof conferencePaperSchema>;
export type GrantApplicationFormData = z.infer<typeof grantApplicationSchema>;
