/**
 * DSW Noting Controller
 * Handles HTTP requests for DSW-Noting integration
 */

const prisma = require("../../../shared/config/database");
const notingIntegrationService = require("../services/notingIntegrationService");
const asyncHandler = require("../../../shared/utils/asyncHandler");
const ApiResponse = require("../../../shared/utils/ApiResponse");
const log = require("../../../shared/utils/logger");
const { SuccessMessages } = require("../constants");

/**
 * Create Club Creation Noting
 * POST /api/dsw/noting/club-creation
 */
const createClubCreationNoting = asyncHandler(async (req, res) => {
  const clubData = {
    name: req.body.name,
    categoryId: req.body.categoryId,
    purpose: req.body.purpose,
    academicSession: req.body.academicSession,
    facultyFacilitatorId: req.body.facultyFacilitatorId,
    chairpersonId: req.body.chairpersonId,
    targetStudentGroup: req.body.targetStudentGroup,
    expectedActivityTypes: req.body.expectedActivityTypes,
    codeOfConductAccepted: req.body.codeOfConductAccepted,
    antiDiscriminationAccepted: req.body.antiDiscriminationAccepted,
    meetingFrequency: req.body.meetingFrequency,
    estimatedAnnualActivityCount: req.body.estimatedAnnualActivityCount,
    proposedEmail: req.body.proposedEmail,
    socialMediaHandles: req.body.socialMediaHandles,
    expectedStudentStrength: req.body.expectedStudentStrength,
    initialMembers: req.body.initialMembers,
  };

  const noting = await notingIntegrationService.createClubCreationNoting(
    clubData,
    req.user.id,
  );

  return ApiResponse.created(res, noting, SuccessMessages.CLUB_CREATED);
});

/**
 * Create Club Change Request Noting
 * POST /api/dsw/noting/club-change/:clubId
 */
const createClubChangeRequestNoting = asyncHandler(async (req, res) => {
  const { clubId } = req.params;
  const changeData = {
    changeType: req.body.changeType,
    requestedChanges: req.body.requestedChanges,
    justification: req.body.justification,
  };

  const result = await notingIntegrationService.createClubChangeRequestNoting(
    clubId,
    changeData,
    req.user.id,
  );

  return ApiResponse.created(res, result, SuccessMessages.CHANGE_REQUEST_SUBMITTED);
});

/**
 * Process Approved Noting (Webhook/Internal)
 * POST /api/dsw/noting/process-approval
 * Called by the Noting system when a DSW noting is approved
 */
const processApprovedNoting = asyncHandler(async (req, res) => {
  const { notingId, approvedById } = req.body;

  const noting = await prisma.note.findUnique({
    where: { id: notingId },
  });

  if (!noting) {
    return res.status(404).json({
      success: false,
      message: "Noting not found",
    });
  }

  // Check if this is a club creation noting
  if (noting.metadata?.dswModule === "club_creation") {
    const club =
      await notingIntegrationService.processApprovedClubCreationNoting(
        noting,
        approvedById,
      );

    return ApiResponse.success(res, club, "Club created successfully from approved noting");
  }

  // Handle other DSW noting types here (change requests, etc.)
  return ApiResponse.success(res, null, "Noting processed");
});

module.exports = {
  createClubCreationNoting,
  createClubChangeRequestNoting,
  processApprovedNoting,
};
