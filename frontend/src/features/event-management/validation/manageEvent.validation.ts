import { z } from "zod";
import type {
  EventPaymentType,
  OpportunityMode,
  ParticipationType,
} from "../types/event.types";
import {
  sanitizeDigitsInput,
  sanitizeEmailInput,
  sanitizePlainTextInput,
  sanitizeRichTextInput,
  sanitizeUrlInput,
  stripHtml,
} from "@/shared/utils/inputSanitizers";

export interface ManageEventFAQInput {
  question: string;
  answer: string;
}

export interface ManageEventResourceInput {
  category: string;
  type: string;
  description: string;
  estimatedCost?: number;
  pricePerPiece?: number;
  quantity?: number;
}

export interface ManageEventValidationInput {
  description: string;
  longDescription: string;
  venue: string;
  maxCapacity: number | "";
  registrationFee: number | "";
  teamRegistrationFee: number | "";
  registrationStartDate: string;
  registrationEndDate: string;
  logoImageUrl: string;
  opportunityMode: OpportunityMode | null;
  participationType: ParticipationType;
  minTeamSize: number | "";
  maxTeamSize: number | "";
  contactPersonName: string;
  contactEmail: string;
  contactMobile: string;
  alternateContact: string;
  websiteUrl: string;
  socialMediaLinks: Record<string, string>;
  eligibilityCriteria: string;
  rulesAndGuidelines: string;
  prizeDetails: string;
  faqs: ManageEventFAQInput[];
  hasResources: boolean | null;
  resources: ManageEventResourceInput[];
  eventPaymentType: EventPaymentType;
  eventStartDate?: string;
  forPublish: boolean;
}

export interface ManageEventValidationResult {
  sanitized: ManageEventValidationInput;
  fieldErrors: Record<string, string>;
}

const MAX_DESCRIPTION_WORDS = 10;
const MAX_CONTACT_MOBILE_DIGITS = 10;

const countWords = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

const nullablePositiveNumber = z.union([
  z.literal(""),
  z.number().int().min(1),
]);

const optionalMoney = z.union([z.literal(""), z.number().min(1)]);

const resourceSchema = z.object({
  category: z.string().trim().optional().default("internal"),
  type: z.string(),
  description: z.string(),
  estimatedCost: z.number().optional(),
  pricePerPiece: z.number().min(0).optional(),
  quantity: z.number().int().min(1).optional(),
});

const manageEventSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Short description is required."),
    longDescription: z
      .string()
      .refine(
        (value) => stripHtml(value).length > 0,
        "Detailed description is required.",
      ),
    venue: z.string().trim().min(1, "Venue is required."),
    maxCapacity: nullablePositiveNumber,
    registrationFee: optionalMoney,
    teamRegistrationFee: optionalMoney,
    registrationStartDate: z
      .string()
      .trim()
      .min(1, "Registration start date is required."),
    registrationEndDate: z
      .string()
      .trim()
      .min(1, "Registration end date is required."),
    logoImageUrl: z.string(),
    opportunityMode: z
      .enum(["online", "offline", "hybrid"])
      .nullable()
      .refine(Boolean, "Please select a mode of opportunity."),
    participationType: z.enum(["individual", "team"]),
    minTeamSize: nullablePositiveNumber,
    maxTeamSize: nullablePositiveNumber,
    contactPersonName: z
      .string()
      .trim()
      .min(2, "Contact person name must be at least 2 characters."),
    contactEmail: z
      .string()
      .trim()
      .min(1, "Contact email is required.")
      .email("Please enter a valid email address."),
    contactMobile: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" || new RegExp(`^\\d{${MAX_CONTACT_MOBILE_DIGITS}}$`).test(value),
        `Contact mobile must be exactly ${MAX_CONTACT_MOBILE_DIGITS} digits.`,
      ),
    alternateContact: z.string(),
    websiteUrl: z
      .string()
      .trim()
      .refine(
        (value) => !value || /^(https?:\/\/|www\.)/i.test(value),
        "Website URL must start with http://, https://, or www.",
      ),
    socialMediaLinks: z.record(z.string(), z.string()),
    eligibilityCriteria: z.string(),
    rulesAndGuidelines: z.string(),
    prizeDetails: z.string(),
    faqs: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    ),
    hasResources: z.boolean().nullable(),
    resources: z.array(resourceSchema),
    eventPaymentType: z.enum(["free", "paid"]),
    eventStartDate: z.string().optional(),
    forPublish: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (countWords(value.description) > MAX_DESCRIPTION_WORDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: `Short description must be ${MAX_DESCRIPTION_WORDS} words or fewer (currently ${countWords(value.description)} words).`,
      });
    }

    if (value.forPublish && !value.logoImageUrl.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["logoImageUrl"],
        message: "Event logo is required before publishing.",
      });
    }

    if (
      value.registrationStartDate &&
      value.registrationEndDate &&
      new Date(value.registrationEndDate) < new Date(value.registrationStartDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationEndDate"],
        message: "End date must be after start date.",
      });
    }

    if (value.eventStartDate) {
      const eventStart = new Date(value.eventStartDate);
      if (new Date(value.registrationStartDate) > eventStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["registrationStartDate"],
          message: "Registration must open before the event starts.",
        });
      }
      if (new Date(value.registrationEndDate) > eventStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["registrationEndDate"],
          message: "Registration must close before the event starts.",
        });
      }
    }

    if (value.eventPaymentType === "paid") {
      if (value.participationType === "team" && value.teamRegistrationFee === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["teamRegistrationFee"],
          message: "Participation fee must be at least Rs.1.",
        });
      }
      if (
        value.participationType === "individual" &&
        value.registrationFee === ""
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["registrationFee"],
          message: "Participation fee must be at least Rs.1.",
        });
      }
    }

    if (value.participationType === "team") {
      if (value.minTeamSize === "" || value.maxTeamSize === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minTeamSize"],
          message: "Team size is required for team participation.",
        });
      } else if (Number(value.minTeamSize) > Number(value.maxTeamSize)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxTeamSize"],
          message: "Min team size cannot be greater than max team size.",
        });
      }
    }

    if (value.hasResources === true) {
      const validResources = value.resources.filter(
        (resource) =>
          resource.type.trim().length > 0 || resource.description.trim().length > 0,
      );
      if (validResources.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["resources"],
          message: "Please add at least one resource when Resources are enabled.",
        });
      }
    }
  });

export function sanitizeManageEventInput(
  input: Omit<ManageEventValidationInput, "forPublish"> & {
    forPublish?: boolean;
  },
): ManageEventValidationInput {
  return {
    ...input,
    description: sanitizePlainTextInput(input.description, { maxLength: 120 }),
    longDescription: sanitizeRichTextInput(input.longDescription),
    venue: sanitizePlainTextInput(input.venue, { maxLength: 200 }),
    contactPersonName: sanitizePlainTextInput(input.contactPersonName, {
      maxLength: 120,
    }),
    contactEmail: sanitizeEmailInput(input.contactEmail),
    contactMobile: sanitizeDigitsInput(input.contactMobile, {
      maxLength: MAX_CONTACT_MOBILE_DIGITS,
    }),
    alternateContact: sanitizeDigitsInput(input.alternateContact, {
      maxLength: 15,
    }),
    websiteUrl: sanitizeUrlInput(input.websiteUrl),
    socialMediaLinks: Object.fromEntries(
      Object.entries(input.socialMediaLinks).map(([key, value]) => [
        key,
        sanitizeUrlInput(value),
      ]),
    ),
    eligibilityCriteria: sanitizePlainTextInput(input.eligibilityCriteria, {
      maxLength: 2000,
    }),
    rulesAndGuidelines: sanitizePlainTextInput(input.rulesAndGuidelines, {
      maxLength: 4000,
    }),
    prizeDetails: sanitizePlainTextInput(input.prizeDetails, {
      maxLength: 2000,
    }),
    faqs: input.faqs.map((faq) => ({
      question: sanitizePlainTextInput(faq.question, { maxLength: 200 }),
      answer: sanitizePlainTextInput(faq.answer, { maxLength: 500 }),
    })),
    resources: input.resources.map((resource) => ({
      category: sanitizePlainTextInput(resource.category || "internal", {
        maxLength: 30,
      }),
      type: sanitizePlainTextInput(resource.type, { maxLength: 120 }),
      description: sanitizePlainTextInput(resource.description, {
        maxLength: 300,
      }),
      estimatedCost: resource.estimatedCost,
      pricePerPiece: resource.pricePerPiece,
      quantity: resource.quantity,
    })),
    logoImageUrl: input.logoImageUrl.trim(),
    registrationStartDate: input.registrationStartDate.trim(),
    registrationEndDate: input.registrationEndDate.trim(),
    forPublish: input.forPublish ?? false,
  };
}

export function validateManageEventForm(
  input: Omit<ManageEventValidationInput, "forPublish"> & {
    forPublish?: boolean;
  },
): ManageEventValidationResult {
  const sanitized = sanitizeManageEventInput(input);
  const result = manageEventSchema.safeParse(sanitized);

  if (result.success) {
    return { sanitized, fieldErrors: {} };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const rawField = String(issue.path[0] ?? "form");
    const field = rawField === "logoImageUrl" ? "logo" : rawField;
    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return { sanitized, fieldErrors };
}
