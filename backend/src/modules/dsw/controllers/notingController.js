/**
 * DSW Noting Controller
 * Handles HTTP requests for DSW-Noting integration
 */

const notingIntegrationService = require('../services/notingIntegrationService');
const { SuccessMessages } = require('../constants');

/**
 * Create Club Creation Noting
 * POST /api/dsw/noting/club-creation
 */
async function createClubCreationNoting(req, res) {
  try {
    const clubData = {
      name: req.body.name,
      categoryId: req.body.categoryId,
      purpose: req.body.purpose,
      academicSession: req.body.academicSession,
      viceChairpersonId: req.body.viceChairpersonId,
      targetStudentGroup: req.body.targetStudentGroup,
      expectedActivityTypes: req.body.expectedActivityTypes,
      codeOfConductAccepted: req.body.codeOfConductAccepted,
      antiDiscriminationAccepted: req.body.antiDiscriminationAccepted,
      meetingFrequency: req.body.meetingFrequency,
      estimatedAnnualActivityCount: req.body.estimatedAnnualActivityCount,
      infrastructureRequirements: req.body.infrastructureRequirements,
      fundingRequired: req.body.fundingRequired,
      estimatedFundingAmount: req.body.estimatedFundingAmount,
      visibility: req.body.visibility,
      allowInternalCollaboration: req.body.allowInternalCollaboration,
      allowExternalCollaboration: req.body.allowExternalCollaboration,
      proposedEmail: req.body.proposedEmail,
      socialMediaHandles: req.body.socialMediaHandles,
      expectedStudentStrength: req.body.expectedStudentStrength,
      initialMembers: req.body.initialMembers,
    };

    const noting = await notingIntegrationService.createClubCreationNoting(
      clubData,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: SuccessMessages.CLUB_CREATED,
      data: noting,
    });
  } catch (error) {
    console.error('Error in createClubCreationNoting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create club creation noting',
      error: error.message,
    });
  }
}

/**
 * Create Club Change Request Noting
 * POST /api/dsw/noting/club-change/:clubId
 */
async function createClubChangeRequestNoting(req, res) {
  try {
    const { clubId } = req.params;
    const changeData = {
      changeType: req.body.changeType,
      requestedChanges: req.body.requestedChanges,
      justification: req.body.justification,
    };

    const result = await notingIntegrationService.createClubChangeRequestNoting(
      clubId,
      changeData,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: SuccessMessages.CHANGE_REQUEST_SUBMITTED,
      data: result,
    });
  } catch (error) {
    console.error('Error in createClubChangeRequestNoting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create change request noting',
      error: error.message,
    });
  }
}

/**
 * Process Approved Noting (Webhook/Internal)
 * POST /api/dsw/noting/process-approval
 * This is called by the Noting system when a DSW noting is approved
 */
async function processApprovedNoting(req, res) {
  try {
    const { notingId, approvedById } = req.body;

    // Fetch the noting
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const noting = await prisma.note.findUnique({
      where: { id: notingId },
    });

    if (!noting) {
      return res.status(404).json({
        success: false,
        message: 'Noting not found',
      });
    }

    // Check if this is a club creation noting
    if (noting.metadata?.dswModule === 'club_creation') {
      const club = await notingIntegrationService.processApprovedClubCreationNoting(
        noting,
        approvedById
      );

      return res.json({
        success: true,
        message: 'Club created successfully from approved noting',
        data: club,
      });
    }

    // Handle other DSW noting types here (change requests, etc.)

    res.json({
      success: true,
      message: 'Noting processed',
    });
  } catch (error) {
    console.error('Error in processApprovedNoting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process approved noting',
      error: error.message,
    });
  }
}

module.exports = {
  createClubCreationNoting,
  createClubChangeRequestNoting,
  processApprovedNoting,
};
