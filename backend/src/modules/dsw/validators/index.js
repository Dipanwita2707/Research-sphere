/**
 * DSW Validators
 * Input validation for all DSW operations
 */

const { body, param, query, validationResult } = require("express-validator");
const {
  ClubTargetGroup,
  ClubMeetingFrequency,
  ClubActivityTypes,
  ClubChangeType,
  ErrorMessages,
} = require("../constants");

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Validate Club Creation Request (Noting Form)
 */
const validateClubCreation = [
  // Step 1: Core Club Identity
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Club name is required")
    .isLength({ min: 3, max: 256 })
    .withMessage("Club name must be between 3 and 256 characters"),

  body("categoryId")
    .notEmpty()
    .withMessage("Club category is required")
    .isUUID()
    .withMessage("Invalid category ID"),

  body("purpose")
    .trim()
    .notEmpty()
    .withMessage("Purpose/Objective is required")
    .isLength({ min: 50 })
    .withMessage("Purpose must be at least 50 characters"),

  body("academicSession")
    .trim()
    .notEmpty()
    .withMessage("Academic session is required")
    .matches(/^\d{4}[-–]\d{4}$/)
    .withMessage(
      "Academic session must be in format YYYY-YYYY (e.g., 2025-2026)",
    ),

  // Step 2: Authority & Membership
  body("facultyFacilitatorId")
    .notEmpty()
    .withMessage("Faculty Facilitator is required")
    .isString()
    .withMessage("Invalid Faculty Facilitator ID"),

  body("chairpersonId")
    .optional()
    .isString()
    .withMessage("Invalid Chairperson ID"),

  body("initialMembers")
    .optional()
    .isArray()
    .withMessage("Initial members must be an array"),

  body("initialMembers.*")
    .optional()
    .isString()
    .withMessage("Invalid member ID"),

  // Step 3: Governance & Compliance
  body("targetStudentGroup")
    .isArray({ min: 1 })
    .withMessage("At least one target student group is required"),

  body("targetStudentGroup.*")
    .isIn(Object.values(ClubTargetGroup))
    .withMessage("Invalid target student group"),

  body("expectedActivityTypes")
    .isArray({ min: 1 })
    .withMessage("At least one activity type must be selected"),

  body("expectedActivityTypes.*")
    .isIn(ClubActivityTypes)
    .withMessage("Invalid activity type"),

  body("codeOfConductAccepted")
    .equals("true")
    .withMessage("Code of Conduct must be accepted"),

  body("antiDiscriminationAccepted")
    .equals("true")
    .withMessage("Anti-Discrimination Declaration must be accepted"),

  // Step 4: Operational Planning
  body("meetingFrequency")
    .notEmpty()
    .withMessage("Meeting frequency is required")
    .isIn(Object.values(ClubMeetingFrequency))
    .withMessage("Invalid meeting frequency"),

  body("estimatedAnnualActivityCount")
    .notEmpty()
    .withMessage("Estimated annual activity count is required")
    .isInt({ min: 1, max: 100 })
    .withMessage("Activity count must be between 1 and 100"),

  // Step 5: Optional Metadata
  body("proposedEmail")
    .optional()
    .isEmail()
    .withMessage("Invalid email format"),

  body("socialMediaHandles")
    .optional()
    .isObject()
    .withMessage("Social media handles must be an object"),

  body("expectedStudentStrength")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Expected student strength must be a positive integer"),

  handleValidationErrors,
];

/**
 * Validate Add Member Request
 */
const validateAddMember = [
  param("clubId")
    .notEmpty()
    .withMessage("Club ID is required")
    .isUUID()
    .withMessage("Invalid club ID"),

  // Accept a student UID (e.g. "12201501"), an email, or a UUID.
  // The service will resolve whichever form is supplied to the
  // internal UserLogin.id UUID before hitting the database.
  body("studentId")
    .trim()
    .notEmpty()
    .withMessage("Student ID or email is required")
    .isLength({ min: 3, max: 256 })
    .withMessage("Student identifier must be between 3 and 256 characters"),

  handleValidationErrors,
];

/**
 * Validate Remove Member Request
 */
const validateRemoveMember = [
  param("clubId")
    .notEmpty()
    .withMessage("Club ID is required")
    .isUUID()
    .withMessage("Invalid club ID"),

  param("memberId")
    .notEmpty()
    .withMessage("Member ID is required")
    .isUUID()
    .withMessage("Invalid member ID"),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must not exceed 500 characters"),

  handleValidationErrors,
];

/**
 * Validate Club Change Request
 */
const validateClubChangeRequest = [
  param("clubId")
    .notEmpty()
    .withMessage("Club ID is required")
    .isUUID()
    .withMessage("Invalid club ID"),

  body("changeType")
    .notEmpty()
    .withMessage("Change type is required")
    .isIn(Object.values(ClubChangeType))
    .withMessage("Invalid change type"),

  body("requestedChanges")
    .notEmpty()
    .withMessage("Requested changes are required")
    .isObject()
    .withMessage("Requested changes must be an object"),

  body("justification")
    .trim()
    .notEmpty()
    .withMessage("Justification is required")
    .isLength({ min: 50 })
    .withMessage("Justification must be at least 50 characters"),

  handleValidationErrors,
];

/**
 * Validate Get Clubs Query
 */
const validateGetClubs = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status").optional().isString().withMessage("Status must be a string"),

  query("categoryId").optional().isUUID().withMessage("Invalid category ID"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 256 })
    .withMessage("Search query too long"),

  handleValidationErrors,
];

/**
 * Validate Club ID Parameter
 */
const validateClubId = [
  param("clubId")
    .notEmpty()
    .withMessage("Club ID is required")
    .isUUID()
    .withMessage("Invalid club ID"),

  handleValidationErrors,
];

/**
 * Validate Category Creation
 */
const validateCategoryCreation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Category name is required")
    .isLength({ min: 2, max: 128 })
    .withMessage("Category name must be between 2 and 128 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),

  body("sortOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer"),

  handleValidationErrors,
];

const validateClubApplicationCreate = [
  param("clubId")
    .notEmpty()
    .withMessage("Club ID is required")
    .isUUID()
    .withMessage("Invalid club ID"),

  body("clubId")
    .optional()
    .isUUID()
    .withMessage("Invalid club ID"),

  handleValidationErrors,
];

const validateClubApplicationReview = [
  param("clubId")
    .notEmpty()
    .withMessage("Club ID is required")
    .isUUID()
    .withMessage("Invalid club ID"),

  param("applicationId")
    .notEmpty()
    .withMessage("Application ID is required")
    .isUUID()
    .withMessage("Invalid application ID"),

  body("decision")
    .notEmpty()
    .withMessage("Decision is required")
    .isIn(["approved", "rejected"])
    .withMessage("Decision must be approved or rejected"),

  body("reviewNote")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Review note must not exceed 500 characters"),

  handleValidationErrors,
];

module.exports = {
  validateClubCreation,
  validateAddMember,
  validateRemoveMember,
  validateClubChangeRequest,
  validateGetClubs,
  validateClubId,
  validateCategoryCreation,
  validateClubApplicationCreate,
  validateClubApplicationReview,
  handleValidationErrors,
};
