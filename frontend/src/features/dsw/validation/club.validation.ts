import { z } from "zod";
import type { ClubFormData } from "../stores/useClubFormStore";
import {
  sanitizeEmailInput,
  sanitizePlainTextInput,
  sanitizeSessionInput,
  sanitizeSocialHandleInput,
} from "@/shared/utils/inputSanitizers";

const targetGroups = ["all", "ug", "pg", "phd"] as const;
const meetingFrequencies = [
  "monthly",
  "quarterly",
  "half_yearly",
  "annually",
  "event_based",
] as const;
const activityTypes = [
  "Events",
  "Workshops",
  "Competitions",
  "Awareness Drives",
  "Collaborations",
  "Cultural Programs",
  "Technical Talks",
  "Community Service",
] as const;

const optionalEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address (e.g. club@sgtuniversity.org)")
  .optional()
  .or(z.literal(""));

function normalizeAcademicSession(value: string): string {
  const sanitized = sanitizeSessionInput(value).trim();
  const shortMatch = sanitized.match(/^(\d{4})-(\d{2})$/);

  if (!shortMatch) {
    return sanitized;
  }

  const [, startYear, endYearShort] = shortMatch;
  const centuryPrefix = startYear.slice(0, 2);
  return `${startYear}-${centuryPrefix}${endYearShort}`;
}

export const clubFormSchema = z.object({
  clubName: z
    .string()
    .trim()
    .min(3, "Club name must be at least 3 characters")
    .max(100, "Club name must not exceed 100 characters"),
  clubCategoryId: z.string().trim().min(1, "Please select a specific club category"),
  purpose: z
    .string()
    .trim()
    .min(50, "Purpose must be at least 50 characters")
    .max(2000, "Purpose must not exceed 2000 characters"),
  academicSession: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2,4}$/,
      "Format must be YYYY-YY or YYYY-YYYY (e.g. 2025-26 or 2025-2026)",
    )
    .transform(normalizeAcademicSession),
  facultyFacilitatorId: z.string().trim().min(1, "Faculty Facilitator is required"),
  initialMembers: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one initial member")
    .max(50, "Cannot add more than 50 initial members"),
  targetStudentGroup: z
    .array(z.enum(targetGroups))
    .min(1, "Select at least one target group"),
  expectedActivityTypes: z
    .array(z.enum(activityTypes))
    .min(1, "Select at least one activity type"),
  codeOfConductAccepted: z.literal(true, {
    message: "You must accept the Code of Conduct",
  }),
  antiDiscriminationAccepted: z.literal(true, {
    message: "You must accept the Anti-Discrimination declaration",
  }),
  meetingFrequency: z.enum(meetingFrequencies, {
    message: "Meeting frequency is required",
  }),
  estimatedAnnualActivityCount: z
    .number()
    .int()
    .min(1, "Must be at least 1 activity per year")
    .max(365, "Cannot exceed 365 activities per year"),
  proposedEmail: optionalEmailSchema,
  socialMediaHandles: z
    .object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .default({}),
  expectedStudentStrength: z
    .number()
    .int()
    .min(2, "If provided, must be at least 2 students")
    .max(10000, "Cannot exceed 10,000 students")
    .nullable()
    .optional(),
});

export const clubStepSchemas = {
  1: clubFormSchema.pick({
    clubName: true,
    clubCategoryId: true,
    purpose: true,
    academicSession: true,
    targetStudentGroup: true,
    expectedActivityTypes: true,
  }),
  2: clubFormSchema.pick({
    facultyFacilitatorId: true,
    initialMembers: true,
    meetingFrequency: true,
    estimatedAnnualActivityCount: true,
    expectedStudentStrength: true,
  }),
  3: clubFormSchema.pick({
    codeOfConductAccepted: true,
    antiDiscriminationAccepted: true,
    proposedEmail: true,
  }),
} as const;

export function sanitizeClubFormPatch(
  field: keyof ClubFormData,
  value: ClubFormData[keyof ClubFormData],
): ClubFormData[keyof ClubFormData] {
  switch (field) {
    case "clubName":
    case "purpose":
      return sanitizePlainTextInput(String(value ?? ""), {
        maxLength: field ===
   "clubName" ? 100 : 2000,
      }) as ClubFormData[keyof ClubFormData];
    case "academicSession":
      return normalizeAcademicSession(String(value ?? "")) as ClubFormData[keyof ClubFormData];
    case "proposedEmail":
      return sanitizeEmailInput(String(value ?? "")) as ClubFormData[keyof ClubFormData];
    case "socialMediaHandles": {
      const handles = (value ?? {}) as ClubFormData["socialMediaHandles"];
      return Object.fromEntries(
        Object.entries(handles).map(([key, handle]) => [
          key,
          sanitizeSocialHandleInput(String(handle ?? "")),
        ]),
      ) as ClubFormData[keyof ClubFormData];
    }
    default:
      return value;
  }
}

export function sanitizeClubFormData(
  value: Partial<ClubFormData>,
): Partial<ClubFormData> {
  return {
    ...value,
    clubName: value.clubName
      ? sanitizePlainTextInput(value.clubName, { maxLength: 100 })
      : value.clubName,
    purpose: value.purpose
      ? sanitizePlainTextInput(value.purpose, { maxLength: 2000 })
      : value.purpose,
    academicSession: value.academicSession
      ? normalizeAcademicSession(value.academicSession)
      : value.academicSession,
    proposedEmail: value.proposedEmail
      ? sanitizeEmailInput(value.proposedEmail)
      : value.proposedEmail,
    socialMediaHandles: Object.fromEntries(
      Object.entries(value.socialMediaHandles ?? {}).map(([key, handle]) => [
        key,
        sanitizeSocialHandleInput(String(handle ?? "")),
      ]),
    ),
  };
}

export function flattenClubErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
