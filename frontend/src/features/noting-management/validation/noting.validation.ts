import { z } from "zod";
import type {
  FestivalFormData,
  SponsorData,
  VenueFormData,
} from "../components/FestivalForm";
import type { StallConfig } from "../components/StallConfigSection";
import type { EventVisibilityFormData } from "@/features/event-management/components/EventSettingsForm";
import {
  sanitizeDigitsInput,
  sanitizeEmailInput,
  sanitizePlainTextInput,
  sanitizeRichTextInput,
  sanitizeUrlInput,
  stripHtml,
} from "@/shared/utils/inputSanitizers";

const MAX_WORDS = 500;
const AMOUNT_MAX = 10_00_000;

export interface BaseNoteValidationInput {
  subcategory: string;
  departmentId: string;
  departmentScope: '' | 'school' | 'central';
  description: string;
  approvalPeriod: "one_time" | "recurring";
  recurringFrequency: string;
  policyCompliance: "yes" | "no" | null;
  amountRequired: boolean;
  amount: string | number;
  points: string[];
}

export interface BaseNoteValidationResult {
  fieldErrors: Record<string, string>;
  sanitized: {
    subcategory: string;
    description: string;
    recurringFrequency: string;
    amount: string;
    points: string[];
  };
}

export interface SectionValidationResult {
  message?: string;
  sectionId?: string;
}

const sponsorSchema = z.object({
  name: z.string(),
  sponsorType: z.string(),
  contactPerson: z.string(),
  designation: z.string(),
  phone: z.string(),
  email: z.string(),
  sponsorLogo: z
    .object({
      filePath: z.string(),
      fileName: z.string(),
    })
    .nullable()
    .optional(),
});

const resourceSchema = z.object({
  type: z.string(),
  description: z.string(),
  pricePerPiece: z.union([z.number().min(0), z.literal(""), z.null()]).optional(),
  quantity: z.union([z.number().int().min(0), z.literal(""), z.null()]).optional(),
});

const venueSchema = z
  .object({
    eventName: z.string().trim().min(1, "Please enter the Event Name."),
    eventType: z.string().trim().min(1, "Please select the Event Type."),
    eventStartDate: z.string().trim().min(1, "Please select the Event Start Date."),
    eventEndDate: z.string().trim().min(1, "Please select the Event End Date."),
    eventPaymentType: z.enum(["free", "paid"]),
    eventParticipationType: z.enum(["individual", "team"]),
    eventRegistrationFeeIndividual: z.union([z.number().min(0), z.literal("")]),
    eventRegistrationFeeTeam: z.union([z.number().min(0), z.literal("")]),
    eventApproxCapacity: z.union([z.number().int().min(1), z.literal("")]),
    eventDutyLeaveAvailable: z.boolean().nullable(),
    eventDutyLeaveRoleType: z.enum(["participants", "organizers", "both"]).optional(),
    eventHasSponsorship: z.boolean().nullable(),
    eventSponsors: z.array(sponsorSchema),
    eventHasResources: z.boolean().nullable(),
    eventResources: z.array(resourceSchema),
    eventCertification: z.boolean().nullable(),
    eventHasPrizes: z.boolean().nullable(),
    eventPrizesAwards: z.array(z.object({ rank: z.string() })),
  })
  .superRefine((value, ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(value.eventStartDate) < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventStartDate"],
        message: "Event Start Date cannot be in the past. Please select a future date.",
      });
    }

    if (new Date(value.eventEndDate) < new Date(value.eventStartDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventEndDate"],
        message: "Event End Date should be after Start Date. Please correct the dates.",
      });
    }

    if (value.eventApproxCapacity === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventApproxCapacity"],
        message: "Please enter the Approximate Capacity.",
      });
    }

    if (value.eventDutyLeaveAvailable === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventDutyLeaveAvailable"],
        message: "Please select Yes or No for Duty Leave Required.",
      });
    }

    if (value.eventDutyLeaveAvailable === true && !value.eventDutyLeaveRoleType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventDutyLeaveRoleType"],
        message:
          "Please select who is eligible for Duty Leave when Duty Leave is enabled.",
      });
    }

    if (value.eventHasSponsorship === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventHasSponsorship"],
        message: "Please select Yes or No for Sponsorship Available.",
      });
    }

    if (value.eventHasSponsorship === true) {
      const validSponsors = value.eventSponsors.filter((s) => s.name.trim());
      if (validSponsors.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventSponsors"],
          message:
            "Please add at least one sponsor with a name when Sponsorship is enabled.",
        });
      }
      for (const sponsor of validSponsors) {
        if (!sponsor.sponsorType.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventSponsors"],
            message: `Sponsor "${sponsor.name}" - Sponsor Type is required.`,
          });
          break;
        }
        if (!sponsor.contactPerson.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventSponsors"],
            message: `Sponsor "${sponsor.name}" - Contact Person is required.`,
          });
          break;
        }
        if (!sponsor.designation.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventSponsors"],
            message: `Sponsor "${sponsor.name}" - Designation is required.`,
          });
          break;
        }
        if (!sponsor.phone.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventSponsors"],
            message: `Sponsor "${sponsor.name}" - Phone number is required.`,
          });
          break;
        }
        if (!sponsor.email.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventSponsors"],
            message: `Sponsor "${sponsor.name}" - Email is required.`,
          });
          break;
        }
        if (!z.string().email().safeParse(sponsor.email).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventSponsors"],
            message: `Sponsor "${sponsor.name}" - Please enter a valid email address.`,
          });
          break;
        }
        if (!sponsor.sponsorLogo?.filePath) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventSponsors"],
            message: `Sponsor "${sponsor.name}" - Logo is required. Please upload a JPG or PNG file.`,
          });
          break;
        }
      }
    }

    if (value.eventHasResources === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventHasResources"],
        message: "Please select Yes or No for Event Resources.",
      });
    }

    if (
      value.eventHasResources === true &&
      value.eventResources.filter(
        (resource) => resource.type.trim() || resource.description.trim(),
      ).length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventResources"],
        message: "Please add at least one resource when Resources are enabled.",
      });
    }

    if (value.eventCertification === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventCertification"],
        message: "Please select Yes or No for Certificates.",
      });
    }

    if (value.eventHasPrizes === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventHasPrizes"],
        message: "Please select Yes or No for Prizes & Winners.",
      });
    }

    if (value.eventHasPrizes === true && value.eventPrizesAwards.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventPrizesAwards"],
        message: "Please add at least one prize when Prizes & Winners is enabled.",
      });
    }

    if (value.eventPaymentType === "paid") {
      if (
        value.eventParticipationType === "individual" &&
        value.eventRegistrationFeeIndividual === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventRegistrationFeeIndividual"],
          message:
            "Please enter the Participation Fee (Rs.) for paid individual events.",
        });
      }
      if (
        value.eventParticipationType === "team" &&
        value.eventRegistrationFeeTeam === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventRegistrationFeeTeam"],
          message: "Please enter the Fee per Team (Rs.) for paid team events.",
        });
      }
    }
  });

const festivalSchema = z
  .object({
    festivalName: z.string().trim().min(1, "Please enter the Festival Name."),
    startDate: z.string().trim().min(1, "Please select the Festival Start Date."),
    endDate: z.string().trim().min(1, "Please select the Festival End Date."),
    subEvents: z.array(
      z.object({
        eventType: z.enum(["venue", "stall"]),
        venueFormData: z.object({
          eventName: z.string(),
        }),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seenSubEventNames = new Set<string>();

    if (new Date(value.startDate) < today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Festival Start Date cannot be in the past. Please select a future date.",
      });
    }

    if (new Date(value.endDate) < new Date(value.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Festival End Date should be after Start Date. Please correct the dates.",
      });
    }

    if (value.subEvents.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subEvents"],
        message: "Please add at least one sub-event to the festival.",
      });
    }

    value.subEvents.forEach((subEvent, index) => {
      const normalizedName = subEvent.venueFormData?.eventName?.trim().toLocaleLowerCase();
      if (!normalizedName) {
        return;
      }
      if (seenSubEventNames.has(normalizedName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subEvents", index, "venueFormData", "eventName"],
          message: "Sub-event names must be unique within the same festival.",
        });
        return;
      }
      seenSubEventNames.add(normalizedName);
    });
  });

const visibilitySchema = z.object({
  visibleToRoles: z.array(z.string()).min(1, "Please select at least one role in Audience Visibility settings."),
});

const baseNoteSchema = z
  .object({
    subcategory: z.string().trim().min(1, "Please select a subcategory."),
    departmentId: z.string().uuid("Please select a department."),
    departmentScope: z
      .string()
      .refine((value) => value === "school" || value === "central", "Please select a department."),
    description: z
      .string()
      .refine(
        (value) => stripHtml(value).trim().length > 0,
        "Please add a description explaining your request.",
      ),
    approvalPeriod: z.enum(["one_time", "recurring"]),
    recurringFrequency: z.string(),
    policyCompliance: z.enum(["yes", "no"]),
    amountRequired: z.boolean(),
    amount: z.string(),
    points: z.array(z.string()).min(1, "Please add at least one requirement point."),
  })
  .superRefine((value, ctx) => {
    const wordCount = stripHtml(value.description)
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    if (wordCount > MAX_WORDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: `Description exceeds the word limit (${wordCount}/${MAX_WORDS} words).`,
      });
    }

    if (value.approvalPeriod === "recurring" && !value.recurringFrequency.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurringFrequency"],
        message: "Please select a frequency for recurring approval.",
      });
    }

    if (value.amountRequired) {
      const amount = Number(value.amount);
      if (!value.amount.trim() || Number.isNaN(amount) || amount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Please enter a valid amount (Rs.).",
        });
      } else if (amount <= 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Amount must be greater than Rs.1.",
        });
      } else if (amount > AMOUNT_MAX) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Amount cannot exceed Rs.10,00,000 (10 lakh).",
        });
      }
    }
  });

export function sanitizeNoteDescription(value: string): string {
  return sanitizeRichTextInput(value);
}

export function sanitizeNotePoints(points: string[]): string[] {
  return points.map((point) => sanitizePlainTextInput(point, { maxLength: 300 }));
}

export function sanitizeAnnexures<
  T extends { filePath: string; fileName: string; fileDescription?: string; uploading?: boolean },
>(annexures: T[]): T[] {
  return annexures.map((annexure) => ({
    ...annexure,
    fileName: sanitizePlainTextInput(annexure.fileName, { maxLength: 200 }),
    fileDescription: sanitizePlainTextInput(annexure.fileDescription || "", {
      maxLength: 300,
    }),
  }));
}

export function sanitizeVenueFormData(value: VenueFormData): VenueFormData {
  return {
    ...value,
    eventName: sanitizePlainTextInput(value.eventName, { maxLength: 150 }),
    eventType: sanitizePlainTextInput(value.eventType, { maxLength: 80 }),
    eventSponsors: value.eventSponsors.map((sponsor) => sanitizeSponsor(sponsor)),
    eventResources: value.eventResources.map((resource) => ({
      ...resource,
      type: sanitizePlainTextInput(resource.type, { maxLength: 120 }),
      description: sanitizePlainTextInput(resource.description, { maxLength: 300 }),
    })),
    eventPrizesAwards: value.eventPrizesAwards.map((prize) => ({
      ...prize,
      rank: sanitizePlainTextInput(prize.rank, { maxLength: 100 }),
      title: sanitizePlainTextInput(prize.title, { maxLength: 150 }),
      additionalPerks: sanitizePlainTextInput(prize.additionalPerks || "", {
        maxLength: 300,
      }),
    })),
  };
}

export function sanitizeFestivalFormData(value: FestivalFormData): FestivalFormData {
  return {
    ...value,
    festivalName: sanitizePlainTextInput(value.festivalName, { maxLength: 150 }),
    description: sanitizePlainTextInput(value.description, { maxLength: 1000 }),
    coordinator: sanitizePlainTextInput(value.coordinator, { maxLength: 100 }),
    subEvents: value.subEvents.map((subEvent) => ({
      ...subEvent,
      venueFormData: sanitizeVenueFormData(subEvent.venueFormData),
      stallConfig: subEvent.stallConfig
        ? sanitizeStallConfig(subEvent.stallConfig)
        : subEvent.stallConfig,
    })),
  };
}

export function sanitizeEventVisibilitySettings(
  value: EventVisibilityFormData,
): EventVisibilityFormData {
  return {
    ...value,
    allowedSchoolIds: value.allowedSchoolIds.map((id) =>
      sanitizePlainTextInput(id, { maxLength: 50 }),
    ),
    allowedDepartmentIds: value.allowedDepartmentIds.map((id) =>
      sanitizePlainTextInput(id, { maxLength: 50 }),
    ),
    allowedProgramIds: value.allowedProgramIds.map((id) =>
      sanitizePlainTextInput(id, { maxLength: 50 }),
    ),
    allowedSectionIds: value.allowedSectionIds.map((id) =>
      sanitizePlainTextInput(id, { maxLength: 50 }),
    ),
  };
}

export function sanitizeStallConfig(value: StallConfig): StallConfig {
  return {
    ...value,
    creatorStalls: value.creatorStalls.map((stall) => ({
      ...stall,
      name: sanitizePlainTextInput(stall.name, { maxLength: 120 }),
      description: sanitizePlainTextInput(stall.description, {
        maxLength: 300,
      }),
    })),
  };
}

export function validateBaseNoteSubmission(
  input: BaseNoteValidationInput,
): BaseNoteValidationResult {
  const sanitized = {
    subcategory: sanitizePlainTextInput(input.subcategory, { maxLength: 80 }),
    description: sanitizeNoteDescription(input.description),
    recurringFrequency: sanitizePlainTextInput(input.recurringFrequency, {
      maxLength: 50,
    }),
    amount: sanitizePlainTextInput(String(input.amount ?? ""), { maxLength: 20 }),
    points: sanitizeNotePoints(input.points).filter((point) => point.trim()),
  };

  const result = baseNoteSchema.safeParse({
    ...input,
    ...sanitized,
    policyCompliance: input.policyCompliance ?? undefined,
  });

  if (result.success) {
    return { fieldErrors: {}, sanitized };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return { fieldErrors, sanitized };
}

export function validateVenueEventSubmission(
  venueFormData: VenueFormData,
  eventVisibilitySettings: EventVisibilityFormData,
  stallConfig?: StallConfig,
): SectionValidationResult {
  const sanitizedVenue = sanitizeVenueFormData(venueFormData);
  const venueResult = venueSchema.safeParse(sanitizedVenue);
  if (!venueResult.success) {
    return {
      message: venueResult.error.issues[0]?.message,
      sectionId: "section-event-details",
    };
  }

  if (stallConfig) {
    const sanitizedStallConfig = sanitizeStallConfig(stallConfig);
    if (
      sanitizedStallConfig.enableStudentApplied &&
      (sanitizedStallConfig.maxStudentStalls == null ||
        sanitizedStallConfig.maxStudentStalls < 1)
    ) {
      return {
        message:
          "Please enter Max Student Stalls (min 1) when Student-Applied Stalls is enabled.",
        sectionId: "section-event-details",
      };
    }
    if (
      sanitizedStallConfig.enableCreatorMade &&
      sanitizedStallConfig.creatorStalls.some((stall) => !stall.name.trim())
    ) {
      return {
        message: "Each creator-made stall must have a name.",
        sectionId: "section-event-details",
      };
    }
  }

  const visibilityResult = visibilitySchema.safeParse(
    sanitizeEventVisibilitySettings(eventVisibilitySettings),
  );
  if (!visibilityResult.success) {
    return {
      message: visibilityResult.error.issues[0]?.message,
      sectionId: "section-event-settings",
    };
  }

  return {};
}

export function validateFestivalSubmission(
  festivalData: FestivalFormData,
  eventVisibilitySettings: EventVisibilityFormData,
): SectionValidationResult {
  const sanitizedFestival = sanitizeFestivalFormData(festivalData);
  const festivalResult = festivalSchema.safeParse(sanitizedFestival);
  if (!festivalResult.success) {
    return {
      message: festivalResult.error.issues[0]?.message,
      sectionId: "section-event-details",
    };
  }

  for (let index = 0; index < sanitizedFestival.subEvents.length; index += 1) {
    const subEvent = sanitizedFestival.subEvents[index];
    const result = validateVenueEventSubmission(
      subEvent.venueFormData,
      eventVisibilitySettings,
      subEvent.eventType === "stall" ? subEvent.stallConfig : undefined,
    );
    if (result.message) {
      return {
        message: `Sub-Event #${index + 1}: ${result.message}`,
        sectionId: result.sectionId,
      };
    }
  }

  const visibilityResult = visibilitySchema.safeParse(
    sanitizeEventVisibilitySettings(eventVisibilitySettings),
  );
  if (!visibilityResult.success) {
    return {
      message: visibilityResult.error.issues[0]?.message,
      sectionId: "section-event-settings",
    };
  }

  return {};
}

function sanitizeSponsor(sponsor: SponsorData): SponsorData {
  return {
    ...sponsor,
    name: sanitizePlainTextInput(sponsor.name, { maxLength: 150 }),
    contactPerson: sanitizePlainTextInput(sponsor.contactPerson, {
      maxLength: 120,
    }),
    designation: sanitizePlainTextInput(sponsor.designation, {
      maxLength: 120,
    }),
    phone: sanitizeDigitsInput(sponsor.phone, { maxLength: 15 }),
    email: sanitizeEmailInput(sponsor.email),
    notes: sanitizePlainTextInput(sponsor.notes, { maxLength: 500 }),
    paymentMethodOtherLabel: sanitizePlainTextInput(
      sponsor.paymentMethodOtherLabel,
      { maxLength: 80 },
    ),
    transactionId: sanitizePlainTextInput(sponsor.transactionId, {
      maxLength: 120,
    }),
    sponsorLogo: sponsor.sponsorLogo
      ? {
          filePath: sanitizeUrlInput(sponsor.sponsorLogo.filePath),
          fileName: sanitizePlainTextInput(sponsor.sponsorLogo.fileName, {
            maxLength: 200,
          }),
        }
      : sponsor.sponsorLogo,
    receipt: sponsor.receipt
      ? {
          filePath: sanitizeUrlInput(sponsor.receipt.filePath),
          fileName: sanitizePlainTextInput(sponsor.receipt.fileName, {
            maxLength: 200,
          }),
        }
      : sponsor.receipt,
    inKindItems: sponsor.inKindItems.map((item) => ({
      ...item,
      itemName: sanitizePlainTextInput(item.itemName, { maxLength: 120 }),
      category: sanitizePlainTextInput(item.category, { maxLength: 80 }),
      description: sanitizePlainTextInput(item.description, { maxLength: 300 }),
    })),
  };
}
