/**
 * Zod middleware for Noting System
 * Provides input validation and sanitization for noting routes
 */

const { z } = require("zod");
const { validateRequest } = require("../../../shared/utils/zodValidation");
const { CATEGORIES } = require("../config/noting.config");
const {
  LIMITS,
  RECURRING_FREQUENCIES,
  APPROVAL_PERIODS,
} = require("../constants/noting.constants");
const {
  sanitizeDigits,
  sanitizeEmail,
  sanitizePlainText,
  sanitizeRichText,
  sanitizeStringArray,
  sanitizeUrl,
} = require("../../../shared/utils/sanitize");

const validCategories = Object.keys(CATEGORIES);
const validSubcategoriesFor = (category) =>
  CATEGORIES[category] ? Object.keys(CATEGORIES[category].subcategories) : [];

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

const optionalNullableBooleanish = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().nullable().optional());

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

const requiredRemark = (message) =>
  z.preprocess(
    (value) => sanitizePlainText(value, { maxLength: 5000 }),
    z.string().min(1, message),
  );

const optionalDateString = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return sanitizePlainText(value, { maxLength: 64 });
}, z.string().min(1).optional());

const optionalNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return Number(value);
}, z.number().finite().optional());

const optionalNullableNumber = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (value === null) return null;
  return Number(value);
}, z.number().finite().nullable().optional());

const attachmentSchema = z
  .object({
    filePath: optionalPlainText(
      LIMITS.FILE_PATH_MAX_LENGTH,
      "Attachment file path is too long",
    ),
    fileName: optionalPlainText(
      LIMITS.FILE_NAME_MAX_LENGTH,
      "Attachment file name is too long",
    ),
    fileDescription: optionalPlainText(
      LIMITS.FILE_DESCRIPTION_MAX_LENGTH,
      "Attachment file description is too long",
    ),
  })
  .strip();

const resourceSchema = z
  .object({
    category: z.enum(["internal", "external"]).optional(),
    type: optionalPlainText(256, "Resource type is too long"),
    description: optionalPlainText(2000, "Resource description is too long"),
    estimatedCost: optionalNullableNumber,
    pricePerPiece: optionalNullableNumber,
    quantity: optionalNullableNumber,
  })
  .strip();

const sponsorAssignmentSchema = z
  .object({
    id: optionalPlainText(64, "Assignment ID is too long"),
    uid: optionalPlainText(64, "Assignment UID is too long"),
    displayName: optionalPlainText(256, "Display name is too long"),
    department: optionalPlainText(256, "Department is too long"),
  })
  .strip();

const inKindItemSchema = z
  .object({
    itemName: optionalPlainText(256, "Item name is too long"),
    category: optionalPlainText(128, "Item category is too long"),
    quantity: optionalNullableNumber,
    estimatedValue: optionalNullableNumber,
    description: optionalPlainText(2000, "Item description is too long"),
    deliveryStatus: z.enum(["pending", "received", "not_received"]).optional(),
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
    }, z.string().min(10, "Phone number is invalid").max(15, "Phone number is invalid").optional()),
    email: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      return sanitizeEmail(value);
    }, z.string().email("Please enter a valid email address").optional()),
    notes: optionalPlainText(2000, "Sponsor notes are too long"),
    contributionType: z.enum(["cash", "in_kind", "both"]).optional(),
    cashAmount: optionalNullableNumber,
    paymentStatus: z
      .enum(["received", "pending", "partial", "not_received"])
      .optional(),
    paymentMethod: z
      .enum(["cash", "upi", "card", "net_banking", "other"])
      .optional(),
    paymentMethodOtherLabel: optionalPlainText(128, "Payment method label is too long"),
    transactionId: optionalPlainText(256, "Transaction ID is too long"),
    receipt: z
      .object({
        filePath: optionalPlainText(1024, "Receipt file path is too long"),
        fileName: optionalPlainText(256, "Receipt file name is too long"),
      })
      .strip()
      .nullish(),
    sponsorLogo: z
      .object({
        filePath: optionalPlainText(1024, "Logo file path is too long"),
        fileName: optionalPlainText(256, "Logo file name is too long"),
      })
      .strip()
      .nullish(),
    cashAssignedTo: sponsorAssignmentSchema.nullish(),
    inKindItems: z.array(inKindItemSchema).optional(),
    originSource: z.enum(["noting", "event"]).optional(),
    savedAt: z.any().optional(),
    originalSnapshot: z.any().optional(),
  })
  .strip();

const prizeSchema = z
  .object({
    position: optionalNullableNumber,
    rank: optionalPlainText(128, "Prize rank is too long"),
    title: optionalPlainText(256, "Prize title is too long"),
    prizeType: z
      .enum([
        "cash",
        "certificate",
        "trophy",
        "internship",
        "scholarship",
        "merchandise",
        "voucher",
        "custom",
      ])
      .optional(),
    prizeAmount: optionalNullableNumber,
    additionalPerks: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      return Array.isArray(value)
        ? sanitizeStringArray(value, { maxLength: 128 })
        : sanitizeStringArray(String(value).split(","), { maxLength: 128 });
    }, z.array(z.string()).optional()),
    sortOrder: optionalNullableNumber,
  })
  .strip();

const stallConfigSchema = z
  .object({
    enableStudentApplied: optionalBooleanish,
    maxStudentStalls: optionalNullableNumber,
    stallFee: optionalNullableNumber,
    enableCreatorMade: optionalBooleanish,
    creatorStalls: z
      .array(
        z
          .object({
            name: optionalPlainText(256, "Stall name is too long"),
          })
          .strip(),
      )
      .optional(),
  })
  .strip()
  .passthrough();

const eventVisibilitySettingsSchema = z
  .object({
    visibleToRoles: z
      .array(
        z.enum(["student", "faculty", "staff", "admin", "parent", "superadmin"]),
      )
      .optional(),
    studentFilterType: z.enum(["all", "custom"]).optional(),
    allowedSchoolIds: z.array(z.string().uuid()).optional(),
    allowedDepartmentIds: z.array(z.string().uuid()).optional(),
    allowedProgramIds: z.array(z.string().uuid()).optional(),
    allowedBatchYears: z.array(z.preprocess((value) => Number(value), z.number().int())).optional(),
    allowedSectionIds: z.array(z.string().uuid()).optional(),
    allowExtraPasses: optionalBooleanish,
    maxExtraPassesPerUser: optionalNullableNumber,
  })
  .strip()
  .superRefine((value, ctx) => {
    if (
      value.allowExtraPasses === true &&
      value.maxExtraPassesPerUser !== undefined &&
      value.maxExtraPassesPerUser !== null &&
      value.maxExtraPassesPerUser < 1
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxExtraPassesPerUser"],
        message:
          "maxExtraPassesPerUser must be at least 1 when extra passes are enabled",
      });
    }
  });

const venuePayloadSchema = z
  .object({
    eventName: optionalPlainText(256, "Event name is too long"),
    eventType: optionalPlainText(64, "Event type is too long"),
    eventStartDate: optionalDateString,
    eventEndDate: optionalDateString,
    eventPaymentType: z.enum(["free", "paid"]).optional(),
    eventParticipationType: z.enum(["individual", "team"]).optional(),
    eventRegistrationFeeIndividual: optionalNullableNumber,
    eventRegistrationFeeTeam: optionalNullableNumber,
    eventApproxCapacity: optionalNullableNumber,
    eventDutyLeaveAvailable: optionalNullableBooleanish,
    eventDutyLeaveEligibility: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      return sanitizeStringArray(value, { maxLength: 64 });
    }, z.array(z.string()).optional()),
    eventDutyLeaveRoleType: z
      .enum(["participants", "organizers", "both"])
      .optional()
      .nullable(),
    eventHasSponsorship: optionalNullableBooleanish,
    eventSponsors: z.array(sponsorSchema).optional().nullable(),
    eventHasResources: optionalNullableBooleanish,
    eventResources: z.array(resourceSchema).optional().nullable(),
    eventCertification: optionalNullableBooleanish,
    eventCapacityFixed: optionalNullableNumber,
    eventHasPrizes: optionalNullableBooleanish,
    eventPrizesAwards: z.array(prizeSchema).optional().nullable(),
  })
  .strip();

const subEventSchema = z
  .object({
    eventType: optionalPlainText(64, "Sub-event type is too long"),
    stallConfig: stallConfigSchema.optional().nullable(),
    venueFormData: venuePayloadSchema.optional(),
  })
  .strip()
  .passthrough();

const noteBodySchema = z
  .object({
    category: z
      .preprocess(
        (value) => sanitizePlainText(value, { maxLength: 64 }),
        z
          .string()
          .min(1, "Please select a category for your note")
          .refine(
            (value) => validCategories.includes(value),
            `Invalid category. Please choose from: ${validCategories.join(", ")}`,
          ),
      )
      .optional(),
    subcategory: optionalPlainText(128, "Subcategory is invalid"),
    description: optionalRichText(
      50000,
      "Description exceeds maximum supported length",
    ),
    approvalPeriod: z.enum(Object.values(APPROVAL_PERIODS)).optional(),
    recurringFrequency: z
      .enum(Object.values(RECURRING_FREQUENCIES))
      .optional()
      .nullable(),
    policyCompliance: z.enum(["yes", "no"]).optional().nullable(),
    policyWithinSgtu: optionalBooleanish,
    policyOutsideSgtu: optionalBooleanish,
    policyBoth: optionalBooleanish,
    policyJustification: optionalPlainText(4000, "Policy justification is too long"),
    amountRequired: optionalBooleanish,
    amount: optionalNullableNumber,
    points: z.preprocess((value) => {
      if (!Array.isArray(value)) return value;
      return value.map((entry) => {
        if (typeof entry === "string") return sanitizePlainText(entry, { maxLength: 2000 });
        if (entry && typeof entry === "object" && entry.content) {
          return sanitizePlainText(entry.content, { maxLength: 2000 });
        }
        return sanitizePlainText(entry, { maxLength: 2000 });
      });
    }, z.array(z.string()).optional()),
    attachments: z.array(attachmentSchema).optional(),
    departmentId: z.string().uuid("departmentId must be a valid UUID").optional().nullable(),
    departmentScope: z.enum(["school", "central"]).optional().nullable(),
    submit: optionalBooleanish,
    eventClubId: z.string().uuid("eventClubId must be a valid UUID").optional().nullable(),
    eventVisibilitySettings: eventVisibilitySettingsSchema.optional().nullable(),
    notingEventType: z.enum(["venue", "stall", "festival"]).optional().nullable(),
    stallConfig: stallConfigSchema.optional().nullable(),
    festivalMeta: z
      .object({
        name: optionalPlainText(256, "Festival name is too long"),
        startDate: optionalDateString,
        endDate: optionalDateString,
        description: optionalPlainText(2000, "Festival description is too long"),
        coordinator: optionalPlainText(256, "Festival coordinator is too long"),
      })
      .strip()
      .optional()
      .nullable(),
    subEvents: z.array(subEventSchema).optional().nullable(),
  })
  .merge(venuePayloadSchema)
  .strip();

const createNoteBodySchema = noteBodySchema.superRefine((body, ctx) => {
  const hasDepartmentId = typeof body.departmentId === "string" && body.departmentId.trim().length > 0;
  const hasDepartmentScope = typeof body.departmentScope === "string" && body.departmentScope.trim().length > 0;

  if (hasDepartmentId !== hasDepartmentScope) {
    ctx.addIssue({
      code: "custom",
      path: ["departmentId"],
      message: "departmentId and departmentScope must be provided together",
    });
  }

  if (body.submit === true) {
    if (!hasDepartmentId) {
      ctx.addIssue({
        code: "custom",
        path: ["departmentId"],
        message: "Please select a department before submitting",
      });
    }
    if (!hasDepartmentScope) {
      ctx.addIssue({
        code: "custom",
        path: ["departmentScope"],
        message: "Department scope is required before submitting",
      });
    }
  }

  if (!body.category) {
    ctx.addIssue({
      code: "custom",
      path: ["category"],
      message:
        "Please select a category for your note (e.g., Academic, Administrative)",
    });
  }

  if (!body.subcategory) {
    ctx.addIssue({
      code: "custom",
      path: ["subcategory"],
      message: "Please select a subcategory for your note",
    });
  } else if (body.category) {
    const validSubcategories = validSubcategoriesFor(body.category);
    if (
      validSubcategories.length > 0 &&
      !validSubcategories.includes(body.subcategory)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["subcategory"],
        message: `Invalid subcategory for this category. Available options: ${validSubcategories.join(", ")}`,
      });
    }
  }
});

const updateDraftBodySchema = noteBodySchema.partial().superRefine((body, ctx) => {
  const hasDepartmentId = typeof body.departmentId === "string" && body.departmentId.trim().length > 0;
  const hasDepartmentScope = typeof body.departmentScope === "string" && body.departmentScope.trim().length > 0;

  if (
    (body.departmentId !== undefined || body.departmentScope !== undefined) &&
    hasDepartmentId !== hasDepartmentScope
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["departmentId"],
      message: "departmentId and departmentScope must be provided together",
    });
  }

  if (body.category && body.subcategory) {
    const validSubcategories = validSubcategoriesFor(body.category);
    if (
      validSubcategories.length > 0 &&
      !validSubcategories.includes(body.subcategory)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["subcategory"],
        message: `Invalid subcategory for this category. Available options: ${validSubcategories.join(", ")}`,
      });
    }
  }
});

const noteIdParamsSchema = z.object({
  id: z
    .string()
    .uuid(
      "Invalid note ID. The note you are trying to access may not exist or the link is incorrect.",
    ),
}).strip();

const copyIdParamsSchema = z.object({
  copyId: z.string().uuid("Invalid copy ID"),
}).strip();

const createNoteValidation = validateRequest({ body: createNoteBodySchema });
const updateDraftValidation = validateRequest({
  params: noteIdParamsSchema,
  body: updateDraftBodySchema,
});
const noteIdValidation = validateRequest({ params: noteIdParamsSchema });

const approveNoteValidation = validateRequest({
  params: noteIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Remarks are mandatory for approval. Please provide your observations or comments before approving.",
      ),
    })
    .strip(),
});

const recommendNoteValidation = validateRequest({
  params: noteIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Remarks are mandatory for recommendation. Please provide your reasoning before recommending.",
      ),
    })
    .strip(),
});

const notRecommendNoteValidation = validateRequest({
  params: noteIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Remarks are mandatory when not recommending. Please explain your reasoning.",
      ),
    })
    .strip(),
});

const rejectNoteValidation = validateRequest({
  params: noteIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Rejection reason is required. Please explain why you are rejecting this note so the creator can understand what needs to be corrected.",
      ),
    })
    .strip(),
});

const revertNoteValidation = validateRequest({
  params: noteIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Please provide instructions to the creator explaining what changes are needed before they resubmit the note.",
      ),
    })
    .strip(),
});

const forwardNoteValidation = validateRequest({
  params: noteIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Please add a note explaining why you are forwarding this request to the next person.",
      ),
      nextHolderId: z.string().uuid("Invalid user selected. Please choose a valid person to forward to.").optional(),
      automated: optionalBooleanish,
    })
    .strip(),
});

const listNotesValidation = validateRequest({
  query: z
    .object({
      filter: z.enum(["mine", "pending", "handled", "all"]).optional(),
      status: z
        .enum(["draft", "pending", "approved", "rejected", "reverted"])
        .optional(),
      category: z
        .string()
        .trim()
        .refine(
          (value) => validCategories.includes(value),
          `Category must be one of: ${validCategories.join(", ")}`,
        )
        .optional(),
      search: optionalPlainText(256, "Search must be a string"),
      createdById: z.string().uuid("Created by ID must be a valid UUID").optional(),
      startDate: optionalDateString,
      endDate: optionalDateString,
      page: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        return Number(value);
      }, z.number().int().min(1).optional()),
      limit: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        return Number(value);
      }, z.number().int().min(1).max(100).optional()),
      includeCounts: z.enum(["true", "false"]).optional(),
      includeHandledCount: z.enum(["true", "false"]).optional(),
      cursor: optionalPlainText(64, "Cursor is invalid"),
      handledAction: z.enum(["approved", "rejected"]).optional(),
    })
    .strip(),
});

const previewIdValidation = validateRequest({
  query: z
    .object({
      category: z
        .string()
        .trim()
        .refine(
          (value) => validCategories.includes(value),
          `Category must be one of: ${validCategories.join(", ")}`,
        ),
      subcategory: z.preprocess(
        (value) => sanitizePlainText(value, { maxLength: 128 }),
        z.string().min(1, "Subcategory is required"),
      ),
    })
    .strip(),
});

const forwardOptionsValidation = validateRequest({
  query: z
    .object({
      departmentId: z.string().uuid("Department ID must be a valid UUID"),
    })
    .strip(),
});

const adminAnalyticsValidation = validateRequest({
  query: z
    .object({
      startDate: optionalDateString,
      endDate: optionalDateString,
    })
    .strip(),
});

const adminActivityAnalyticsValidation = validateRequest({
  query: z
    .object({
      startDate: optionalDateString,
      endDate: optionalDateString,
      page: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        return Number(value);
      }, z.number().int().min(1).optional()),
      limit: z.preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        return Number(value);
      }, z.number().int().min(1).max(100).optional()),
    })
    .strip(),
});

const sendCopyValidation = validateRequest({
  params: noteIdParamsSchema,
  body: z
    .object({
      userIds: z
        .array(z.string().uuid("Each user ID must be a valid UUID"))
        .min(1, "Please select at least one user to send the copy to."),
      remarks: requiredRemark(
        "Remarks are mandatory when sending copies. Please explain what work needs to be done.",
      ),
    })
    .strip(),
});

const replyCopyValidation = validateRequest({
  params: copyIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Remarks are mandatory when replying. Please provide your update.",
      ),
      attachments: z.array(attachmentSchema).optional(),
    })
    .strip(),
});

const forwardCopyValidation = validateRequest({
  params: copyIdParamsSchema,
  body: z
    .object({
      remarks: requiredRemark(
        "Remarks are mandatory when forwarding a copy. Please explain why the work is not complete.",
      ),
    })
    .strip(),
});

const completeCopyValidation = validateRequest({
  params: copyIdParamsSchema,
});

module.exports = {
  createNoteValidation,
  updateDraftValidation,
  noteIdValidation,
  approveNoteValidation,
  recommendNoteValidation,
  notRecommendNoteValidation,
  rejectNoteValidation,
  revertNoteValidation,
  forwardNoteValidation,
  listNotesValidation,
  previewIdValidation,
  forwardOptionsValidation,
  adminAnalyticsValidation,
  adminActivityAnalyticsValidation,
  sendCopyValidation,
  replyCopyValidation,
  forwardCopyValidation,
  completeCopyValidation,
};
