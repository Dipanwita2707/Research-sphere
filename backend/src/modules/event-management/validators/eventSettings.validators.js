/**
 * Event Settings Validators
 *
 * Input validation for event settings / visibility endpoints.
 */

const { z } = require("zod");
const { validateRequest } = require("../../../shared/utils/zodValidation");

const VALID_ROLES = [
  "student",
  "faculty",
  "staff",
  "admin",
  "parent",
  "superadmin",
];

const uuidArraySchema = z
  .array(z.string().uuid("Contains invalid UUID(s)"))
  .optional();

const validateEventSettingsUpdate = validateRequest({
  body: z
    .object({
      isActive: z.boolean().optional(),
      visibleToRoles: z
        .array(z.enum(VALID_ROLES))
        .min(1, "At least one visible role must be selected")
        .optional(),
      studentFilterType: z.enum(["all", "custom"]).optional(),
      allowedSchoolIds: uuidArraySchema,
      allowedDepartmentIds: uuidArraySchema,
      allowedProgramIds: uuidArraySchema,
      allowedSectionIds: uuidArraySchema,
      allowedBatchYears: z
        .array(
          z.preprocess(
            (value) => Number(value),
            z.number().int().min(2000).max(2100),
          ),
        )
        .optional(),
      allowExtraPasses: z.boolean().optional(),
      maxExtraPassesPerUser: z.preprocess(
        (value) => {
          if (value === undefined || value === null || value === "") return undefined;
          return Number(value);
        },
        z.number().int().min(0).max(20).optional(),
      ),
    })
    .strip()
    .superRefine((body, ctx) => {
      if (
        body.allowExtraPasses === true &&
        body.maxExtraPassesPerUser !== undefined &&
        body.maxExtraPassesPerUser < 1
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["maxExtraPassesPerUser"],
          message:
            "maxExtraPassesPerUser must be at least 1 when allowExtraPasses is enabled",
        });
      }
    }),
});

module.exports = {
  validateEventSettingsUpdate,
};
