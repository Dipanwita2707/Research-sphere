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

const requiredPlainText = (maxLength, requiredMessage, maxMessage) =>
  z.preprocess((value) => sanitizePlainText(value, { maxLength }), z
    .string()
    .min(1, requiredMessage)
    .max(maxLength, maxMessage || `Field must not exceed ${maxLength} characters`));

const requiredDateTimeString = z.preprocess((value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00Z`;
  }
  return value;
}, z.string().datetime("Please provide a valid datetime."));

const optionalDateTimeString = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00Z`;
  }
  return value;
}, z.string().datetime("Please provide a valid datetime.").optional());

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

const teamIdSchema = z.string().uuid("Invalid team ID");
const invitationIdSchema = z.string().uuid("Invalid invitation ID");
const requestIdSchema = z.string().uuid("Invalid request ID");
const prizeIdSchema = z.string().uuid("Invalid prize ID");
const roundIdSchema = z.string().uuid("Invalid round ID");
const fieldIdSchema = z.string().uuid("Invalid custom field ID");
const volunteerIdSchema = z.string().uuid("Invalid volunteer ID");

const customFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "email",
  "phone",
  "url",
  "date",
  "time",
  "datetime",
  "dropdown",
  "radio",
  "checkbox",
  "file",
  "image",
]);

const customFieldBodySchema = z
  .object({
    fieldName: optionalPlainText(128, "Field name must not exceed 128 characters"),
    fieldLabel: requiredPlainText(
      256,
      "Field Label validation failed: Field label is required.",
      "Field Label validation failed: Field label must not exceed 256 characters.",
    ),
    fieldType: customFieldTypeSchema,
    isRequired: optionalBooleanish,
    placeholder: optionalPlainText(256, "Placeholder must not exceed 256 characters"),
    helpText: optionalPlainText(512, "Help text must not exceed 512 characters"),
    options: z
      .array(requiredPlainText(128, "Option value is required", "Option value must not exceed 128 characters"))
      .optional(),
    validationRules: z.record(z.any()).optional(),
    defaultValue: optionalPlainText(512, "Default value must not exceed 512 characters"),
    sortOrder: optionalInteger({ min: 0, max: Number.MAX_SAFE_INTEGER }, "Sort order must be a non-negative integer"),
  })
  .strip();

const customFieldCreateBodySchema = customFieldBodySchema
  .superRefine((value, ctx) => {
    if (
      ["dropdown", "radio", "checkbox"].includes(value.fieldType) &&
      (!Array.isArray(value.options) || value.options.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Options validation failed: At least one option is required for this field type.",
      });
    }
  });

const customFieldUpdateBodySchema = customFieldBodySchema
  .partial()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please provide at least one field to update.",
      });
      return;
    }

    if (Array.isArray(value.options) && value.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Options validation failed: At least one option is required.",
      });
      return;
    }

    if (
      value.fieldType &&
      ["dropdown", "radio", "checkbox"].includes(value.fieldType) &&
      !Array.isArray(value.options)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Options validation failed: At least one option is required for this field type.",
      });
    }
  });

const validateRegistrationFormSubmit = validateRequest({
  body: z
    .object({
      couponCode: optionalPlainText(64, "Coupon code must not exceed 64 characters"),
    })
    .passthrough(),
});

const validateExtraPassCreate = validateRequest({
  body: z
    .object({
      guestName: requiredPlainText(
        256,
        "Guest Name validation failed: Guest name is required.",
        "Guest Name validation failed: Guest name must not exceed 256 characters.",
      ),
      guestEmail: z.preprocess(
        (value) => sanitizeEmail(value),
        z.string().email("Guest Email validation failed: Please enter a valid email address."),
      ),
      mobileNumber: z.preprocess(
        (value) => sanitizeDigits(value, { maxLength: 15 }),
        z
          .string()
          .regex(/^\d{10,15}$/, "Mobile Number validation failed: Enter a valid 10 to 15 digit number."),
      ),
      relationship: requiredPlainText(
        128,
        "Relationship validation failed: Relationship is required.",
        "Relationship validation failed: Relationship must not exceed 128 characters.",
      ),
    })
    .strip(),
});

const validateCustomFieldCreate = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: customFieldCreateBodySchema,
});

const validateCustomFieldUpdate = validateRequest({
  params: z.object({ id: eventIdSchema, fieldId: fieldIdSchema }).strip(),
  body: customFieldUpdateBodySchema,
});

const validateCustomFieldDelete = validateRequest({
  params: z.object({ id: eventIdSchema, fieldId: fieldIdSchema }).strip(),
});

const validateCustomFieldReorder = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      fieldOrderMap: z.record(
        z.string().uuid("Custom field key must be a valid UUID"),
        z.preprocess(
          (value) => Number(value),
          z.number().int().min(0, "Sort order must be a non-negative integer"),
        ),
      ),
    })
    .strip()
    .refine((value) => Object.keys(value.fieldOrderMap || {}).length > 0, {
      message: "Field order map must include at least one custom field.",
      path: ["fieldOrderMap"],
    }),
});

const validateTeamCreate = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      teamName: requiredPlainText(
        256,
        "Team Name validation failed: Team name is required.",
        "Team Name validation failed: Team name must not exceed 256 characters.",
      ),
    })
    .strip(),
});

const validateEventTeamParams = validateRequest({
  params: z.object({ id: eventIdSchema, teamId: teamIdSchema }).strip(),
});

const validateEventTeamMemberParams = validateRequest({
  params: z
    .object({
      id: eventIdSchema,
      teamId: teamIdSchema,
      memberId: z.string().uuid("Invalid team member ID"),
    })
    .strip(),
});

const validateTeamInvite = validateRequest({
  params: z.object({ id: eventIdSchema, teamId: teamIdSchema }).strip(),
  body: z
    .object({
      inviteeId: z.string().uuid("Invitee validation failed: Invitee ID must be a valid UUID."),
      message: optionalPlainText(500, "Invitation message must not exceed 500 characters"),
    })
    .strip(),
});

const validateInvitationResponse = validateRequest({
  params: z.object({ id: eventIdSchema, invitationId: invitationIdSchema }).strip(),
  body: z.object({ accept: booleanish }).strip(),
});

const validateJoinRequestResponse = validateRequest({
  params: z.object({ id: eventIdSchema, requestId: requestIdSchema }).strip(),
  body: z.object({ accept: booleanish }).strip(),
});

const validateTeamRequestJoin = validateRequest({
  params: z.object({ id: eventIdSchema, teamId: teamIdSchema }).strip(),
  body: z
    .object({
      message: optionalPlainText(500, "Join request message must not exceed 500 characters"),
    })
    .strip(),
});

const validateToggleLookingForTeammates = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z.object({ looking: booleanish }).strip(),
});

const validateToggleTeamLookingForMembers = validateRequest({
  params: z.object({ id: eventIdSchema, teamId: teamIdSchema }).strip(),
  body: z.object({ looking: booleanish }).strip(),
});

const validateStallApplicationSubmit = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      stallName: requiredPlainText(
        256,
        "Stall Name validation failed: Stall name is required.",
        "Stall Name validation failed: Stall name must not exceed 256 characters.",
      ),
      stallType: requiredPlainText(
        64,
        "Stall Type validation failed: Stall type is required.",
        "Stall Type validation failed: Stall type must not exceed 64 characters.",
      ),
      stallDescription: optionalPlainText(5000, "Stall description is too long"),
      businessName: optionalPlainText(256, "Business name must not exceed 256 characters"),
      contactNumber: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        return sanitizeDigits(value, { maxLength: 15 });
      }, z.string().regex(/^\d{10,15}$/, "Contact Number validation failed: Enter a valid 10 to 15 digit number.").optional()),
      emailId: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        return sanitizeEmail(value);
      }, z.string().email("Email validation failed: Please enter a valid email address.").optional()),
      isSelling: optionalBooleanish,
      priceRangeMin: optionalFiniteNumber(z.number().min(0, "Minimum price must be zero or greater")),
      priceRangeMax: optionalFiniteNumber(z.number().min(0, "Maximum price must be zero or greater")),
      stallSize: optionalPlainText(32, "Stall size is invalid"),
      customStallSize: optionalPlainText(64, "Custom stall size must not exceed 64 characters"),
      electricityRequired: optionalBooleanish,
      additionalPowerWatts: optionalInteger({ min: 0, max: 100000 }, "Additional power watts must be a non-negative integer"),
      tableRequired: optionalBooleanish,
      chairsCount: optionalInteger({ min: 0, max: 200 }, "Chairs count must be between 0 and 200"),
      specialSetup: z.array(z.string().max(128, "Special setup item is too long")).optional(),
      specialSetupOther: optionalPlainText(256, "Special setup notes must not exceed 256 characters"),
      stallCategory: optionalPlainText(64, "Stall category is invalid"),
      stallFees: optionalFiniteNumber(z.number().min(0, "Stall fee must be zero or greater")),
      paymentMode: optionalPlainText(32, "Payment mode is invalid"),
      transactionId: optionalPlainText(256, "Transaction ID must not exceed 256 characters"),
      paymentScreenshot: optionalPlainText(1024, "Payment screenshot path is too long"),
      documents: z.array(z.string().max(1024, "Document path is too long")).optional(),
      eventRulesAccepted: optionalBooleanish,
      refundPolicyAccepted: optionalBooleanish,
      safetyComplianceAccepted: optionalBooleanish,
      termsAccepted: optionalBooleanish,
      spaceRequired: optionalPlainText(64, "Space required value is invalid"),
      waterRequired: optionalBooleanish,
      specialRequirements: optionalPlainText(2000, "Special requirements are too long"),
      category: optionalPlainText(128, "Category is invalid"),
      businessDescription: optionalPlainText(4000, "Business description is too long"),
      products: z.array(z.string().max(256, "Product entry is too long")).optional(),
      gstNumber: optionalPlainText(64, "GST number is invalid"),
      foodLicenseNumber: optionalPlainText(64, "Food license number is invalid"),
      documentUrls: z.array(z.string().max(1024, "Document URL is too long")).optional(),
    })
    .strip()
    .superRefine((value, ctx) => {
      const termsOk =
        value.termsAccepted === true ||
        (value.eventRulesAccepted === true &&
          value.refundPolicyAccepted === true &&
          value.safetyComplianceAccepted === true);

      if (!termsOk) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["termsAccepted"],
          message: "Terms validation failed: You must accept all required terms and conditions.",
        });
      }

      if (
        value.priceRangeMin !== undefined &&
        value.priceRangeMax !== undefined &&
        value.priceRangeMax < value.priceRangeMin
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["priceRangeMax"],
          message: "Maximum price must be greater than or equal to minimum price.",
        });
      }
    }),
});

const validateStallApplicationParams = validateRequest({
  params: z
    .object({
      id: eventIdSchema,
      appId: z.string().uuid("Invalid stall application ID"),
    })
    .strip(),
});

const validateStallBulkUpdate = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      applicationIds: z
        .array(z.string().uuid("Each application ID must be a valid UUID"))
        .min(1, "Please select at least one stall application."),
      status: z.enum(["approved", "rejected"]),
      rejectionReason: optionalPlainText(2000, "Rejection reason must not exceed 2000 characters"),
    })
    .strip()
    .superRefine((value, ctx) => {
      if (value.status === "rejected" && !String(value.rejectionReason || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejectionReason"],
          message: "Rejection Reason validation failed: Rejection reason is required when status is rejected.",
        });
      }
    }),
});

const validateStallApplicationReview = validateRequest({
  params: z
    .object({
      id: eventIdSchema,
      appId: z.string().uuid("Invalid stall application ID"),
    })
    .strip(),
  body: z
    .object({
      status: z.enum(["approved", "rejected"]),
      rejectionReason: optionalPlainText(2000, "Rejection reason must not exceed 2000 characters"),
    })
    .strip()
    .superRefine((value, ctx) => {
      if (value.status === "rejected" && !String(value.rejectionReason || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejectionReason"],
          message: "Rejection Reason validation failed: Rejection reason is required when status is rejected.",
        });
      }
    }),
});

const validateStallParams = validateRequest({
  params: z
    .object({
      id: eventIdSchema,
      stallId: z
        .string()
        .trim()
        .min(1, "Stall ID is required")
        .max(32, "Stall ID is invalid")
        .regex(/^[A-Za-z0-9-]+$/, "Stall ID format is invalid"),
    })
    .strip(),
});

const validateStallCreate = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      stallName: requiredPlainText(
        256,
        "Stall Name validation failed: Stall name is required.",
        "Stall Name validation failed: Stall name must not exceed 256 characters.",
      ),
      stallType: optionalPlainText(64, "Stall type must not exceed 64 characters"),
      description: optionalPlainText(5000, "Description is too long"),
      stallCategory: optionalPlainText(64, "Stall category must not exceed 64 characters"),
      size: optionalPlainText(32, "Size is invalid"),
      location: optionalPlainText(256, "Location is too long"),
      businessName: optionalPlainText(256, "Business name is too long"),
      electricityRequired: optionalBooleanish,
      waterRequired: optionalBooleanish,
      specialRequirements: optionalPlainText(2000, "Special requirements are too long"),
      products: z.array(z.string().max(256, "Product entry is too long")).optional(),
    })
    .strip(),
});

const validateStallUpdate = validateRequest({
  params: z
    .object({
      id: eventIdSchema,
      stallId: z
        .string()
        .trim()
        .min(1, "Stall ID is required")
        .max(32, "Stall ID is invalid")
        .regex(/^[A-Za-z0-9-]+$/, "Stall ID format is invalid"),
    })
    .strip(),
  body: z
    .object({
      stallName: optionalPlainText(256, "Stall name must not exceed 256 characters"),
      stallType: optionalPlainText(64, "Stall type must not exceed 64 characters"),
      description: optionalPlainText(5000, "Description is too long"),
      stallCategory: optionalPlainText(64, "Stall category must not exceed 64 characters"),
      size: optionalPlainText(32, "Size is invalid"),
      location: optionalPlainText(256, "Location is too long"),
      businessName: optionalPlainText(256, "Business name is too long"),
      electricityRequired: optionalBooleanish,
      waterRequired: optionalBooleanish,
      specialRequirements: optionalPlainText(2000, "Special requirements are too long"),
      products: z.array(z.string().max(256, "Product entry is too long")).optional(),
    })
    .strip()
    .refine((value) => Object.keys(value).length > 0, {
      message: "Please provide at least one stall field to update.",
    }),
});

const prizeTypeSchema = z.enum([
  "cash",
  "certificate",
  "trophy",
  "internship",
  "scholarship",
  "merchandise",
  "voucher",
  "custom",
]);

const prizeCreateBodySchema = z
  .object({
    position: optionalInteger({ min: 1, max: 1000 }, "Position must be a positive integer"),
    rank: requiredPlainText(
      64,
      "Rank validation failed: Rank is required.",
      "Rank validation failed: Rank must not exceed 64 characters.",
    ),
    title: requiredPlainText(
      128,
      "Title validation failed: Prize title is required.",
      "Title validation failed: Prize title must not exceed 128 characters.",
    ),
    description: optionalPlainText(512, "Description must not exceed 512 characters"),
    prizeType: prizeTypeSchema.optional(),
    prizeAmount: optionalFiniteNumber(z.number().min(0, "Prize amount must be zero or greater")),
    additionalPerks: z.any().optional(),
    sortOrder: optionalInteger({ min: 0, max: Number.MAX_SAFE_INTEGER }, "Sort order must be a non-negative integer"),
    isActive: optionalBooleanish,
  })
  .strip();

const validatePrizeCreate = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: prizeCreateBodySchema,
});

const validatePrizeUpdate = validateRequest({
  params: z.object({ id: eventIdSchema, prizeId: prizeIdSchema }).strip(),
  body: prizeCreateBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: "Please provide at least one prize field to update.",
  }),
});

const validatePrizeDelete = validateRequest({
  params: z.object({ id: eventIdSchema, prizeId: prizeIdSchema }).strip(),
});

const validatePrizeReorder = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      prizeOrders: z
        .array(
          z
            .object({
              prizeId: prizeIdSchema,
              sortOrder: z.preprocess(
                (value) => Number(value),
                z.number().int().min(0, "Sort order must be a non-negative integer"),
              ),
            })
            .strip(),
        )
        .min(1, "At least one prize order entry is required"),
    })
    .strip(),
});

const validatePrizeBulkUpsert = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      prizes: z
        .array(
          prizeCreateBodySchema.extend({
            id: z.string().uuid("Invalid prize ID").optional(),
          }),
        )
        .min(1, "At least one prize entry is required"),
    })
    .strip(),
});

const validatePrizeToggleEnabled = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z.object({ enabled: booleanish }).strip(),
});

const roundCreateBodySchema = z
  .object({
    name: requiredPlainText(
      128,
      "Round Name validation failed: Round name is required.",
      "Round Name validation failed: Round name must not exceed 128 characters.",
    ),
    description: optionalPlainText(512, "Round description must not exceed 512 characters"),
    startTime: requiredDateTimeString,
    endTime: requiredDateTimeString,
    roundType: optionalPlainText(32, "Round type is invalid"),
    sortOrder: optionalInteger({ min: 0, max: Number.MAX_SAFE_INTEGER }, "Sort order must be a non-negative integer"),
  })
  .strip()
  .superRefine((value, ctx) => {
    if (new Date(value.endTime) <= new Date(value.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End Time validation failed: End time must be after start time.",
      });
    }
  });

const validateRoundCreate = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: roundCreateBodySchema,
});

const validateRoundUpdate = validateRequest({
  params: z.object({ id: eventIdSchema, roundId: roundIdSchema }).strip(),
  body: z
    .object({
      name: optionalPlainText(128, "Round name must not exceed 128 characters"),
      description: optionalPlainText(512, "Round description must not exceed 512 characters"),
      startTime: optionalDateTimeString,
      endTime: optionalDateTimeString,
      roundType: optionalPlainText(32, "Round type is invalid"),
      sortOrder: optionalInteger({ min: 0, max: Number.MAX_SAFE_INTEGER }, "Sort order must be a non-negative integer"),
      isActive: optionalBooleanish,
    })
    .strip()
    .refine((value) => Object.keys(value).length > 0, {
      message: "Please provide at least one round field to update.",
    })
    .superRefine((value, ctx) => {
      if (value.startTime && value.endTime && new Date(value.endTime) <= new Date(value.startTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "End Time validation failed: End time must be after start time.",
        });
      }
    }),
});

const validateRoundDelete = validateRequest({
  params: z.object({ id: eventIdSchema, roundId: roundIdSchema }).strip(),
});

const validateRoundReorder = validateRequest({
  params: z.object({ id: eventIdSchema }).strip(),
  body: z
    .object({
      roundOrders: z
        .array(
          z
            .object({
              id: roundIdSchema,
              sortOrder: z.preprocess(
                (value) => Number(value),
                z.number().int().min(0, "Sort order must be a non-negative integer"),
              ),
            })
            .strip(),
        )
        .min(1, "At least one round order entry is required"),
    })
    .strip(),
});

const validateVolunteerParams = validateRequest({
  params: z.object({ id: eventIdSchema, volunteerId: volunteerIdSchema }).strip(),
});

const validateVolunteerUpdate = validateRequest({
  params: z.object({ id: eventIdSchema, volunteerId: volunteerIdSchema }).strip(),
  body: z
    .object({
      role: optionalPlainText(128, "Role must not exceed 128 characters"),
      canScanQr: optionalBooleanish,
      assignedGate: optionalPlainText(128, "Assigned gate must not exceed 128 characters"),
    })
    .strip()
    .refine((value) => Object.keys(value).length > 0, {
      message: "Please provide at least one volunteer field to update.",
    }),
});

module.exports = {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateQRScan,
  validateVolunteerAssignment,
  validateVolunteerParams,
  validateVolunteerUpdate,
  validateListQuery,
  validateFeedback,
  validateRegistrationFormSubmit,
  validateExtraPassCreate,
  validateCustomFieldCreate,
  validateCustomFieldUpdate,
  validateCustomFieldDelete,
  validateCustomFieldReorder,
  validateTeamCreate,
  validateEventTeamParams,
  validateEventTeamMemberParams,
  validateTeamInvite,
  validateInvitationResponse,
  validateJoinRequestResponse,
  validateTeamRequestJoin,
  validateToggleLookingForTeammates,
  validateToggleTeamLookingForMembers,
  validateStallApplicationSubmit,
  validateStallApplicationParams,
  validateStallApplicationReview,
  validateStallBulkUpdate,
  validateStallParams,
  validateStallCreate,
  validateStallUpdate,
  validatePrizeCreate,
  validatePrizeUpdate,
  validatePrizeDelete,
  validatePrizeReorder,
  validatePrizeBulkUpsert,
  validatePrizeToggleEnabled,
  validateRoundCreate,
  validateRoundUpdate,
  validateRoundDelete,
  validateRoundReorder,
};
