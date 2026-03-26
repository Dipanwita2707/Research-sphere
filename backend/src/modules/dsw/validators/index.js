/**
 * DSW Validators
 * Input validation for all DSW operations
 */

const { z } = require("zod");
const {
  ClubTargetGroup,
  ClubMeetingFrequency,
  ClubActivityTypes,
  ClubChangeType,
} = require("../constants");
const { validateRequest } = require("../../../shared/utils/zodValidation");
const {
  sanitizeEmail,
  sanitizePlainText,
  sanitizeStringArray,
  sanitizeUrl,
} = require("../../../shared/utils/sanitize");

const booleanish = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const optionalBooleanish = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

const optionalPlainText = (maxLength, message) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return sanitizePlainText(value, { maxLength });
  }, z.string().max(maxLength, message).optional());

const optionalInteger = (min, max, message) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return Number(value);
  }, z.number().int().min(min, message).max(max ?? Number.MAX_SAFE_INTEGER, message).optional());

const clubIdParamsSchema = z.object({
  clubId: z.string().uuid("Invalid club ID"),
}).strip();

const memberIdParamsSchema = z.object({
  clubId: z.string().uuid("Invalid club ID"),
  memberId: z.string().uuid("Invalid member ID"),
}).strip();

const categoryIdParamsSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
}).strip();

const applicationParamsSchema = z.object({
  clubId: z.string().uuid("Invalid club ID"),
  applicationId: z.string().uuid("Invalid application ID"),
}).strip();

const socialMediaSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return value;

  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!entry) continue;
    next[key] = sanitizeUrl(entry, { maxLength: 256 });
  }
  return next;
}, z.record(z.string()).optional());

function normalizeAcademicSession(value) {
  const sanitized = sanitizePlainText(value, { maxLength: 16 });
  const shortMatch = sanitized.match(/^(\d{4})[-–](\d{2})$/);

  if (!shortMatch) {
    return sanitized;
  }

  const [, startYear, endYearShort] = shortMatch;
  return `${startYear}-${startYear.slice(0, 2)}${endYearShort}`;
}

const clubCreationBodySchema = z
  .object({
    name: z.preprocess(
      (value) => sanitizePlainText(value, { maxLength: 256 }),
      z
        .string()
        .min(3, "Club name must be between 3 and 256 characters")
        .max(256, "Club name must be between 3 and 256 characters"),
    ),
    categoryId: z.string().uuid("Invalid category ID"),
    purpose: z.preprocess(
      (value) => sanitizePlainText(value, { maxLength: 4000 }),
      z.string().min(50, "Purpose must be at least 50 characters"),
    ),
    academicSession: z.preprocess(
      (value) => normalizeAcademicSession(value),
      z
        .string()
        .regex(
          /^\d{4}[-–]\d{4}$/,
          "Academic session must be in format YYYY-YYYY (e.g., 2025-2026)",
        ),
    ),
    facultyFacilitatorId: z.preprocess(
      (value) => sanitizePlainText(value, { maxLength: 64 }),
      z.string().min(1, "Faculty Facilitator is required"),
    ),
    chairpersonId: optionalPlainText(64, "Invalid Chairperson ID"),
    initialMembers: z
      .preprocess(
        (value) => sanitizeStringArray(value, { maxLength: 64 }),
        z.array(z.string()).optional(),
      )
      .optional(),
    targetStudentGroup: z
      .array(z.nativeEnum(ClubTargetGroup))
      .min(1, "At least one target student group is required"),
    expectedActivityTypes: z
      .preprocess(
        (value) => sanitizeStringArray(value, { maxLength: 128 }),
        z
          .array(z.enum(ClubActivityTypes))
          .min(1, "At least one activity type must be selected"),
      ),
    codeOfConductAccepted: booleanish.refine(
      (value) => value === true,
      "Code of Conduct must be accepted",
    ),
    antiDiscriminationAccepted: booleanish.refine(
      (value) => value === true,
      "Anti-Discrimination Declaration must be accepted",
    ),
    meetingFrequency: z.nativeEnum(ClubMeetingFrequency, {
      error: "Invalid meeting frequency",
    }),
    estimatedAnnualActivityCount: z.preprocess(
      (value) => Number(value),
      z
        .number()
        .int()
        .min(1, "Activity count must be between 1 and 100")
        .max(100, "Activity count must be between 1 and 100"),
    ),
    proposedEmail: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return sanitizeEmail(value);
    }, z.string().email("Invalid email format").optional()),
    socialMediaHandles: socialMediaSchema,
    expectedStudentStrength: optionalInteger(
      1,
      Number.MAX_SAFE_INTEGER,
      "Expected student strength must be a positive integer",
    ),
  })
  .strip();

const validateClubCreation = validateRequest({
  body: clubCreationBodySchema,
});

const validateAddMember = validateRequest({
  params: clubIdParamsSchema,
  body: z
    .object({
      studentId: z.preprocess(
        (value) => sanitizePlainText(value, { maxLength: 256 }),
        z
          .string()
          .min(3, "Student ID or email is required")
          .max(256, "Student identifier must be between 3 and 256 characters"),
      ),
      role: optionalPlainText(64, "Role is invalid"),
    })
    .strip(),
});

const validateRemoveMember = validateRequest({
  params: memberIdParamsSchema,
  body: z
    .object({
      reason: optionalPlainText(500, "Reason must not exceed 500 characters"),
    })
    .strip(),
});

const validateClubChangeRequest = validateRequest({
  params: clubIdParamsSchema,
  body: z
    .object({
      changeType: z.nativeEnum(ClubChangeType, {
        error: "Invalid change type",
      }),
      requestedChanges: z.record(z.any(), {
        error: "Requested changes must be an object",
      }),
      justification: z.preprocess(
        (value) => sanitizePlainText(value, { maxLength: 4000 }),
        z.string().min(50, "Justification must be at least 50 characters"),
      ),
    })
    .strip(),
});

const validateGetClubs = validateRequest({
  query: z
    .object({
      page: optionalInteger(1, Number.MAX_SAFE_INTEGER, "Page must be a positive integer"),
      limit: optionalInteger(1, 100, "Limit must be between 1 and 100"),
      status: optionalPlainText(64, "Status must be a string"),
      categoryId: z.string().uuid("Invalid category ID").optional(),
      search: optionalPlainText(256, "Search query too long"),
      academicSession: optionalPlainText(16, "Academic session is invalid"),
      myClubs: z.enum(["true", "false"]).optional(),
    })
    .strip(),
});

const validateClubId = validateRequest({
  params: clubIdParamsSchema,
});

const validateCategoryCreation = validateRequest({
  body: z
    .object({
      name: z.preprocess(
        (value) => sanitizePlainText(value, { maxLength: 128 }),
        z
          .string()
          .min(2, "Category name must be between 2 and 128 characters")
          .max(128, "Category name must be between 2 and 128 characters"),
      ),
      description: optionalPlainText(
        500,
        "Description must not exceed 500 characters",
      ),
      sortOrder: optionalInteger(
        0,
        Number.MAX_SAFE_INTEGER,
        "Sort order must be a non-negative integer",
      ),
    })
    .strip(),
});

const validateCategoryUpdate = validateRequest({
  params: categoryIdParamsSchema,
  body: z
    .object({
      name: optionalPlainText(
        128,
        "Category name must be between 2 and 128 characters",
      ),
      description: optionalPlainText(
        500,
        "Description must not exceed 500 characters",
      ),
      sortOrder: optionalInteger(
        0,
        Number.MAX_SAFE_INTEGER,
        "Sort order must be a non-negative integer",
      ),
      isActive: optionalBooleanish,
    })
    .strip(),
});

const validateClubApplicationCreate = validateRequest({
  params: clubIdParamsSchema,
  body: z
    .object({
      clubId: z.string().uuid("Invalid club ID").optional(),
    })
    .strip(),
});

const validateClubApplicationReview = validateRequest({
  params: applicationParamsSchema,
  body: z
    .object({
      decision: z.enum(["approved", "rejected"]),
      reviewNote: optionalPlainText(
        500,
        "Review note must not exceed 500 characters",
      ),
    })
    .strip(),
});

const validateMemberRoleUpdate = validateRequest({
  params: memberIdParamsSchema,
  body: z
    .object({
      role: z.preprocess(
        (value) => sanitizePlainText(value, { maxLength: 64 }),
        z.string().min(1, "Role is required"),
      ),
    })
    .strip(),
});

module.exports = {
  validateClubCreation,
  validateAddMember,
  validateRemoveMember,
  validateClubChangeRequest,
  validateGetClubs,
  validateClubId,
  validateCategoryCreation,
  validateCategoryUpdate,
  validateClubApplicationCreate,
  validateClubApplicationReview,
  validateMemberRoleUpdate,
};
