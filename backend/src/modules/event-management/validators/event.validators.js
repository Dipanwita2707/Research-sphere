/**
 * Event Management Validators
 */

const { z } = require("zod");
const {
  LIMITS,
  EVENT_TYPE,
  EVENT_STATUS,
} = require("../constants/event.constants");
const { validateRequest } = require("../../../shared/utils/zodValidation");
const {
  sanitizeDigits,
  sanitizeEmail,
  sanitizePlainText,
  sanitizeRichText,
  sanitizeStringArray,
  sanitizeUrl,
} = require("../../../shared/utils/sanitize");

const eventIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]+$/, "Invalid event ID format");

const booleanish = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const optionalBooleanish = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

const optionalPlainText = (maxLength, message) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return sanitizePlainText(value, { maxLength });
  }, z.string().max(maxLength, message).optional());

const optionalRichText = (maxLength, message) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return sanitizeRichText(value, { maxLength });
  }, z.string().max(maxLength, message).optional());

const optionalEmail = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return sanitizeEmail(value);
}, z.string().email("Please enter a valid contact email address").optional());

const optionalMobile = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return sanitizeDigits(value, { maxLength: 10 });
}, z.string().regex(/^\d{10}$/, "Please enter a valid 10-digit mobile number").optional());

const optionalUrl = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const sanitized = sanitizeUrl(value);
  return sanitized.startsWith("http") ? sanitized : `https://${sanitized}`;
}, z.string().url("Please enter a valid website URL").optional());

const optionalUrlOrPath = z.preprocess((value) => {
  // Keep explicit null/empty as null so clients can clear stored image fields.
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.union([z.string().min(1), z.null()]).optional());

const optionalInteger = (options, message) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return Number(value);
  }, z.number().int(message).min(options.min, message).max(options.max ?? Number.MAX_SAFE_INTEGER, message).optional());

const optionalFiniteNumber = (schema) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return Number(value);
  }, schema.optional());

const faqSchema = z
  .object({
    question: optionalPlainText(500, "Question must not exceed 500 characters"),
    answer: optionalPlainText(2000, "Answer must not exceed 2000 characters"),
  })
  .strip()
  .transform((faq) => ({
    question: faq.question,
    answer: faq.answer,
  }));

const sponsorReceiptSchema = z
  .object({
    filePath: optionalPlainText(1024, "Receipt file path is too long"),
    fileName: optionalPlainText(256, "Receipt file name is too long"),
  })
  .strip();

const sponsorAssignmentSchema = z
  .object({
    id: optionalPlainText(64, "Assignment ID is too long"),
    uid: optionalPlainText(64, "Assignment UID is too long"),
    displayName: optionalPlainText(256, "Assignment display name is too long"),
    department: optionalPlainText(256, "Assignment department is too long"),
  })
  .strip();

const inKindItemSchema = z
  .object({
    itemName: optionalPlainText(256, "Item name is too long"),
    category: optionalPlainText(128, "Item category is too long"),
    quantity: optionalFiniteNumber(z.number().min(0, "Quantity must be zero or greater")),
    estimatedValue: optionalFiniteNumber(z.number().min(0, "Estimated value must be zero or greater")),
    description: optionalPlainText(2000, "Item description is too long"),
    deliveryStatus: z
      .enum(["pending", "received", "not_received"])
      .optional(),
    assignedTo: sponsorAssignmentSchema.nullish(),
  })
  .strip();

const sponsorSchema = z
  .object({
    id: optionalPlainText(64, "Sponsor ID is too long"),
    name: optionalPlainText(256, "Sponsor name is too long"),
    sponsorType: z
      .enum(["corporate", "individual", "organization", "other"])
      .optional(),
    contactPerson: optionalPlainText(256, "Contact person is too long"),
    designation: optionalPlainText(256, "Designation is too long"),
    phone: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return sanitizeDigits(value, { maxLength: 15 });
    }, z.string().min(10, "Sponsor phone number is invalid").max(15, "Sponsor phone number is invalid").optional()),
    email: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return sanitizeEmail(value);
    }, z.string().email("Sponsor email must be valid").optional()),
    notes: optionalPlainText(2000, "Sponsor notes are too long"),
    contributionType: z.enum(["cash", "in_kind", "both"]).optional(),
    cashAmount: optionalFiniteNumber(z.number().min(0, "Cash amount must be zero or greater")),
    paymentStatus: z
      .enum(["received", "pending", "partial", "not_received"])
      .optional(),
    paymentMethod: z
      .enum(["cash", "upi", "card", "net_banking", "other"])
      .optional(),
    paymentMethodOtherLabel: optionalPlainText(128, "Payment method label is too long"),
    transactionId: optionalPlainText(256, "Transaction ID is too long"),
    receipt: sponsorReceiptSchema.nullish(),
    cashAssignedTo: sponsorAssignmentSchema.nullish(),
    inKindItems: z.array(inKindItemSchema).optional(),
    savedAt: z.any().optional(),
    originalSnapshot: z.any().optional(),
    originSource: z.enum(["noting", "event"]).optional(),
  })
  .strip();

const resourceSchema = z
  .object({
    category: z.enum(["internal", "external"]).optional(),
    type: optionalPlainText(256, "Resource type is too long"),
    description: optionalPlainText(2000, "Resource description is too long"),
    estimatedCost: optionalFiniteNumber(z.number().min(0, "Estimated cost must be zero or greater")),
    pricePerPiece: optionalFiniteNumber(z.number().min(0, "Price per piece must be zero or greater")),
    quantity: optionalFiniteNumber(z.number().min(0, "Quantity must be zero or greater")),
  })
  .strip();

const socialMediaLinksSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return value;

  const next = {};
  for (const [key, link] of Object.entries(value)) {
    if (!link) continue;
    next[key] = sanitizeUrl(link);
  }
  return next;
}, z.record(z.string()).optional());

const validateEventUpdate = validateRequest({
  body: z
    .object({
      description: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        return sanitizePlainText(value, { maxLength: LIMITS.MAX_DESCRIPTION_LENGTH });
      }, z
        .string()
        .refine(
          (value) => value.split(/\s+/).filter(Boolean).length <= 10,
          "Short description must be at most 10 words",
        )
        .optional()),
      longDescription: optionalRichText(
        LIMITS.MAX_LONG_DESCRIPTION_LENGTH || 50000,
        "Detailed description exceeds maximum length",
      ),
      logoImageUrl: optionalUrlOrPath,
      bannerImageUrl: optionalUrlOrPath,
      venue: optionalPlainText(
        LIMITS.MAX_VENUE_LENGTH,
        `Venue must not exceed ${LIMITS.MAX_VENUE_LENGTH} characters`,
      ),
      contactPersonName: optionalPlainText(
        LIMITS.MAX_CONTACT_NAME_LENGTH || 256,
        "Contact person name must not exceed 256 characters",
      ),
      contactEmail: optionalEmail,
      contactMobile: optionalMobile,
      alternateContact: optionalPlainText(32, "Alternate contact is too long"),
      websiteUrl: optionalUrl,
      socialMediaLinks: socialMediaLinksSchema,
      registrationCap: optionalInteger(
        {
          min: LIMITS.REGISTRATION_CAP_MIN ?? 1,
          max: LIMITS.REGISTRATION_CAP_MAX ?? 100000,
        },
        `Registration cap must be between ${LIMITS.REGISTRATION_CAP_MIN ?? 1} and ${LIMITS.REGISTRATION_CAP_MAX ?? 100000}`,
      ),
      maxCapacity: optionalInteger(
        { min: 1, max: Number.MAX_SAFE_INTEGER },
        "Max capacity must be a positive integer",
      ),
      registrationFee: optionalFiniteNumber(
        z.number().min(0, "Registration fee must be a valid decimal number"),
      ),
      teamRegistrationFee: optionalFiniteNumber(
        z.number().min(0, "Team registration fee must be a valid decimal number"),
      ),
      registrationStartDate: z.preprocess((v) => {
        if (v === null || v === undefined || v === "") return undefined;
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v + ":00Z";
        return v;
      }, z.string().datetime().optional()),
      registrationEndDate: z.preprocess((v) => {
        if (v === null || v === undefined || v === "") return undefined;
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v + ":00Z";
        return v;
      }, z.string().datetime().optional()),
      eligibilityDisplayFormat: z
        .enum(["points", "paragraph", "both"])
        .optional(),
      rulesDisplayFormat: z
        .enum(["points", "paragraph", "both"])
        .optional(),
      eligibilityCriteria: optionalPlainText(10000, "Eligibility criteria are too long"),
      rulesAndGuidelines: optionalPlainText(20000, "Rules and guidelines are too long"),
      prizeDetails: optionalPlainText(10000, "Prize details are too long"),
      certificateAvailable: optionalBooleanish,
      faqs: z.preprocess((v) => (v === null ? undefined : v), z.array(faqSchema).optional()),
      opportunityMode: z.enum(["online", "offline", "hybrid"]).optional(),
      participationType: z.enum(["individual", "team"]).optional(),
      minTeamSize: optionalInteger(
        { min: 1, max: 1000 },
        "Min team size must be a positive integer",
      ),
      maxTeamSize: optionalInteger(
        { min: 1, max: 1000 },
        "Max team size must be a positive integer",
      ),
      maxTeamLimit: optionalInteger(
        { min: 1, max: 100000 },
        "Max team limit must be a positive integer",
      ),
      interCollegeAllowed: optionalBooleanish,
      interSpecializationAllowed: optionalBooleanish,
      allowCrossInstituteTeams: optionalBooleanish,
      allowTeamEditAfterSubmission: optionalBooleanish,
      autoApproveTeams: optionalBooleanish,
      teamRegistrationDeadline: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.string().date().optional()),
      autoApproveRegistration: optionalBooleanish,
      showParticipantsPublicly: optionalBooleanish,
      allowWithdrawRegistration: optionalBooleanish,
      allowEditAfterSubmission: optionalBooleanish,
      lockTeamAfterDeadline: optionalBooleanish,
      lookingForTeammatesEnabled: optionalBooleanish,
      allowPublicTeamListing: optionalBooleanish,
      allowJoinRequests: optionalBooleanish,
      allowInviteSystem: optionalBooleanish,
      prizesEnabled: optionalBooleanish,
      requireFormSubmission: optionalBooleanish,
      approxCapacity: optionalInteger(
        { min: 0, max: 1000000 },
        "Approximate capacity must be zero or greater",
      ),
      dutyLeaveAvailable: optionalBooleanish,
      dutyLeaveEligibility: z
        .preprocess((value) => {
          if (value === undefined || value === null) return undefined;
          return sanitizeStringArray(value, { maxLength: 64 });
        }, z.array(z.string()).optional()),
      dutyLeaveRoleType: z
        .enum(["participants", "organizers", "both"])
        .optional()
        .nullable(),
      hasSponsorship: optionalBooleanish,
      sponsors: z.array(sponsorSchema).optional().nullable(),
      showSponsorshipPublicly: optionalBooleanish,
      hasResources: optionalBooleanish,
      resources: z.array(resourceSchema).optional().nullable(),
    })
    .strip(),
});

const validateEventId = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
});

const validateEventPublish = validateRequest({
  body: z
    .object({
      registrationStartDate: z.preprocess((v) => {
        if (v === null || v === undefined || v === "") return undefined;
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v + ":00Z";
        return v;
      }, z.string().datetime().optional()),
      registrationEndDate: z.preprocess((v) => {
        if (v === null || v === undefined || v === "") return undefined;
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v + ":00Z";
        return v;
      }, z.string().datetime().optional()),
    })
    .strip(),
});

const validateQRScan = validateRequest({
  body: z
    .object({
      qrCode: z.preprocess(
        (value) => sanitizePlainText(value, { maxLength: 2048 }),
        z.string().min(1, "QR code is required"),
      ),
      entryType: z.enum(["entry", "exit"]).optional(),
      entriesToCheckIn: optionalInteger(
        { min: 1, max: 50 },
        "entriesToCheckIn must be an integer between 1 and 50",
      ),
      peopleCount: optionalInteger(
        { min: 1, max: 50 },
        "peopleCount must be an integer between 1 and 50",
      ),
      markStudentExit: optionalBooleanish,
      gateLocation: optionalPlainText(128, "Gate location must not exceed 128 characters"),
      remarks: optionalPlainText(500, "Remarks must not exceed 500 characters"),
    })
    .strip(),
});

const validateVolunteerAssignment = validateRequest({
  body: z
    .object({
      userId: z.string().uuid("Invalid user ID"),
      role: optionalPlainText(128, "Role must not exceed 128 characters"),
      canScanQr: optionalBooleanish,
      assignedGate: optionalPlainText(128, "Assigned gate must not exceed 128 characters"),
    })
    .strip(),
});

const validateListQuery = validateRequest({
  query: z
    .object({
      page: optionalInteger({ min: 1, max: LIMITS.MAX_PAGE_SIZE }, "Page must be a positive integer"),
      limit: optionalInteger(
        { min: 1, max: LIMITS.MAX_PAGE_SIZE },
        `Limit must be between 1 and ${LIMITS.MAX_PAGE_SIZE}`,
      ),
      status: z.nativeEnum(EVENT_STATUS).optional(),
      eventType: z.nativeEnum(EVENT_TYPE).optional(),
      search: optionalPlainText(256, "Search term must not exceed 256 characters"),
      myEvents: z.enum(["true", "false"]).optional(),
      filter: optionalPlainText(64, "Filter is invalid"),
      studentApply: z.enum(["true", "false"]).optional(),
    })
    .strip(),
});

const validateFeedback = validateRequest({
  body: z
    .object({
      points: z
        .array(
          z.preprocess(
            (value) => Number(value),
            z.number().int().min(1).max(10),
          ),
        )
        .length(10, "Please provide exactly 10 ratings (1-10)"),
      shortDescription: optionalPlainText(2000, "Short description must not exceed 2000 characters"),
    })
    .strip(),
});

module.exports = {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateQRScan,
  validateVolunteerAssignment,
  validateListQuery,
  validateFeedback,
};
