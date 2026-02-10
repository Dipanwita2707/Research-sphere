/**
 * DSW Noting Integration Service
 * Handles integration between DSW and Noting system
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const clubService = require('./clubService');
const { DSWNotingConfig } = require('../constants');
const approvalFlowService = require('../../noting/services/approvalFlow.service');
const { isCentralDepartmentRole } = require('../../noting/config/noting.config');

/**
 * Process approved Club Creation noting
 * This is called by the Noting system when a DSW noting is approved
 * @param {Object} noting - Approved noting object
 * @param {string} approvedById - User ID who approved
 * @returns {Promise<Object>} Created club
 */
async function processApprovedClubCreationNoting(noting, approvedById) {
  try {
    // Validate this is a DSW Club Creation noting
    if (
      noting.category !== DSWNotingConfig.CATEGORY ||
      noting.subcategory !== DSWNotingConfig.SUBCATEGORY
    ) {
      throw new Error('Invalid noting category for DSW club creation');
    }

    // Create club from approved noting
    // All club data is now stored in Note fields (clubName, clubCategoryId, etc.)
    const club = await clubService.createClubFromNoting(
      noting.id,
      approvedById
    );

    return club;
  } catch (error) {
    console.error('Error processing approved club creation noting:', error);
    throw error;
  }
}

/**
 * Extract club data from noting
 * @param {Object} noting - Noting object
 * @returns {Object} Club data
 */
function extractClubDataFromNoting(noting) {
  // The noting metadata should contain the club creation form data
  const metadata = noting.metadata || {};
  
  // Check if clubData is nested (new format from form)
  const clubData = metadata.clubData || metadata;

  // Validate required fields
  const requiredFields = [
    'clubName',
    'clubCategoryId',
    'purpose',
    'academicSession',
    'viceChairpersonId',
    'targetStudentGroup',
    'expectedActivityTypes',
    'meetingFrequency',
    'estimatedAnnualActivityCount',
    'infrastructureRequirements',
    'fundingRequired',
    'visibility',
  ];

  for (const field of requiredFields) {
    if (!clubData[field]) {
      throw new Error(`Missing required field in noting metadata: ${field}`);
    }
  }

  // Extract and return club data (handle both naming conventions)
  return {
    name: clubData.clubName || clubData.name,
    categoryId: clubData.clubCategoryId || clubData.categoryId,
    purpose: clubData.purpose,
    academicSession: clubData.academicSession,
    facultyFacilitatorId: noting.createdById, // Faculty who created the noting
    viceChairpersonId: clubData.viceChairpersonId,
    targetStudentGroup: clubData.targetStudentGroup,
    expectedActivityTypes: clubData.expectedActivityTypes,
    codeOfConductAccepted: clubData.codeOfConductAccepted === true,
    antiDiscriminationAccepted: clubData.antiDiscriminationAccepted === true,
    meetingFrequency: clubData.meetingFrequency,
    estimatedAnnualActivityCount: parseInt(clubData.estimatedAnnualActivityCount),
    infrastructureRequirements: clubData.infrastructureRequirements,
    fundingRequired: clubData.fundingRequired === true,
    estimatedFundingAmount: clubData.estimatedFundingAmount
      ? parseFloat(clubData.estimatedFundingAmount)
      : null,
    visibility: clubData.visibility,
    allowInternalCollaboration: clubData.allowInternalCollaboration !== false,
    allowExternalCollaboration: clubData.allowExternalCollaboration === true,
    proposedEmail: clubData.proposedEmail || null,
    socialMediaHandles: clubData.socialMediaHandles || {},
    expectedStudentStrength: clubData.expectedStudentStrength
      ? parseInt(clubData.expectedStudentStrength)
      : null,
    initialMembers: clubData.initialMembers || [],
    metadata: clubData.additionalMetadata || {},
  };
}

/**
 * Create a Club Creation noting
 * This is called when a faculty initiates club creation
 * @param {Object} clubData - Club creation form data
 * @param {string} createdById - Faculty user ID
 * @returns {Promise<Object>} Created noting
 */
async function createClubCreationNoting(clubData, createdById) {
  try {
    // Generate noting ID
    const year = new Date().getFullYear();
    const prefix = `DSW-CLB-${year}-`;
    
    const lastNote = await prisma.note.findFirst({
      where: {
        notingId: {
          startsWith: prefix,
        },
      },
      orderBy: {
        notingId: 'desc',
      },
    });

    let sequence = 1;
    if (lastNote) {
      const lastSequence = parseInt(lastNote.notingId.split('-')[3]);
      sequence = lastSequence + 1;
    }

    const notingId = `${prefix}${String(sequence).padStart(5, '0')}`;

    // Get category name for description
    let categoryName = 'Unknown Category';
    if (clubData.categoryId) {
      const category = await prisma.clubCategory.findUnique({
        where: { id: clubData.categoryId },
        include: { parent: true },
      });
      if (category) {
        categoryName = category.parent 
          ? `${category.parent.name} - ${category.name}` 
          : category.name;
      }
    }

    // Validate and sanitize funding amount (max 9,999,999,999.99 for Decimal(12,2))
    let validatedFundingAmount = null;
    if (clubData.fundingRequired && clubData.estimatedFundingAmount) {
      const amount = parseFloat(clubData.estimatedFundingAmount);
      if (!isNaN(amount) && amount > 0 && amount < 10000000000) {
        validatedFundingAmount = amount;
      } else if (amount >= 10000000000) {
        throw new Error('Estimated funding amount cannot exceed ₹9,999,999,999.99');
      }
    }

    // Look up vice chairperson UUID by studentId
    let viceChairpersonUuid = null;
    if (clubData.viceChairpersonId) {
      const student = await prisma.studentDetails.findUnique({
        where: { studentId: clubData.viceChairpersonId },
        select: { id: true },
      });
      if (!student) {
        throw new Error(`Vice Chairperson with Student ID ${clubData.viceChairpersonId} not found`);
      }
      viceChairpersonUuid = student.id;
    }

    // Create noting with club data in Note fields (not metadata)
    const noting = await prisma.note.create({
      data: {
        notingId,
        category: DSWNotingConfig.CATEGORY,
        subcategory: DSWNotingConfig.SUBCATEGORY,
        description: `Club Creation Request: ${clubData.name} (${categoryName})`,
        approvalPeriod: 'one_time',
        policyWithinSgtu: true,
        amountRequired: clubData.fundingRequired || false,
        amount: validatedFundingAmount,
        status: 'pending',
        createdById,
        // Store club data in Note fields
        clubName: clubData.name,
        clubCategoryId: clubData.categoryId,
        clubPurpose: clubData.purpose,
        clubAcademicSession: clubData.academicSession,
        clubTargetStudentGroup: clubData.targetStudentGroup,
        clubMeetingFrequency: clubData.meetingFrequency,
        clubFundingRequired: clubData.fundingRequired || false,
        clubEstimatedFundingAmount: validatedFundingAmount,
        clubVisibility: clubData.visibility,
        clubExpectedActivityTypes: clubData.expectedActivityTypes || [],
        clubInfrastructureRequirements: clubData.infrastructureRequirements || [],
        clubEstimatedAnnualActivityCount: clubData.estimatedAnnualActivityCount || 0,
        clubExpectedStudentStrength: clubData.expectedStudentStrength || null,
        clubFacultyFacilitatorId: createdById, // Faculty creating the noting
        clubViceChairpersonId: viceChairpersonUuid,
        clubInitialMembers: clubData.initialMembers || [],
        points: {
          create: [
            {
              sortOrder: 1,
              content: `Club Name: ${clubData.name}`,
            },
            {
              sortOrder: 2,
              content: `Category: ${categoryName}`,
            },
            {
              sortOrder: 3,
              content: `Purpose: ${clubData.purpose}`,
            },
            {
              sortOrder: 4,
              content: `Academic Session: ${clubData.academicSession}`,
            },
            {
              sortOrder: 5,
              content: `Target Group: ${clubData.targetStudentGroup.toUpperCase()}`,
            },
            {
              sortOrder: 6,
              content: `Expected Activities: ${clubData.expectedActivityTypes.join(', ')}`,
            },
            {
              sortOrder: 7,
              content: `Meeting Frequency: ${clubData.meetingFrequency}`,
            },
            {
              sortOrder: 8,
              content: `Estimated Annual Activities: ${clubData.estimatedAnnualActivityCount || 0}`,
            },
            {
              sortOrder: 9,
              content: `Funding Required: ${clubData.fundingRequired ? 'Yes (₹' + (validatedFundingAmount || 0) + ')' : 'No'}`,
            },
            {
              sortOrder: 10,
              content: `Visibility: ${clubData.visibility}`,
            },
          ],
        },
      },
      include: {
        points: true,
        createdBy: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    console.log(`✅ Club creation noting created: ${notingId} - ${clubData.name}`);

    // Initialize workflow - Determine first approver and create history
    const noteContext = { amountRequired: clubData.fundingRequired || false };
    const steps = await approvalFlowService.getFullFlowSteps(
      DSWNotingConfig.CATEGORY,
      DSWNotingConfig.SUBCATEGORY,
      createdById,
      noteContext
    );

    let currentFlowIndex = null;
    let currentHolderId = null;

    if (steps && steps.length > 0) {
      const firstStep = steps[0];
      currentFlowIndex = 0;
      
      // Check if first step is a group (like DSW or CENTRAL_TEAM) - any member can approve
      const isGroupStep = isCentralDepartmentRole(firstStep.authorityType) && firstStep.userIds.length > 0;
      currentHolderId = isGroupStep ? null : (firstStep.userIds[0] ?? null);

      // Update noting with workflow fields
      await prisma.note.update({
        where: { id: noting.id },
        data: {
          currentFlowIndex,
          currentHolderId,
        },
      });

      // Create history entry for submission
      await prisma.noteHistory.create({
        data: {
          noteId: noting.id,
          action: 'SUBMITTED',
          performedById: createdById,
          remarks: 'Club creation noting submitted for approval',
          nextHolderId: currentHolderId,
        },
      });

      console.log(`✅ Workflow initialized: Flow index ${currentFlowIndex}, First approver: ${firstStep.authorityType}`);
    } else {
      console.warn(`⚠️ No approval flow found for club creation noting: ${notingId}`);
    }

    return noting;
  } catch (error) {
    console.error('Error creating club creation noting:', error);
    throw error;
  }
}

/**
 * Create a Club Change Request noting
 * @param {string} clubId - Club ID
 * @param {Object} changeData - Change request data
 * @param {string} createdById - User ID requesting change
 * @returns {Promise<Object>} Created noting and change request
 */
async function createClubChangeRequestNoting(clubId, changeData, createdById) {
  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        category: true,
      },
    });

    if (!club) {
      throw new Error('Club not found');
    }

    // Generate noting ID
    const year = new Date().getFullYear();
    const prefix = `DSW-CHG-${year}-`;
    
    const lastNote = await prisma.note.findFirst({
      where: {
        notingId: {
          startsWith: prefix,
        },
      },
      orderBy: {
        notingId: 'desc',
      },
    });

    let sequence = 1;
    if (lastNote) {
      const lastSequence = parseInt(lastNote.notingId.split('-')[3]);
      sequence = lastSequence + 1;
    }

    const notingId = `${prefix}${String(sequence).padStart(5, '0')}`;

    // Create noting
    const noting = await prisma.note.create({
      data: {
        notingId,
        category: DSWNotingConfig.CATEGORY,
        subcategory: DSWNotingConfig.SUBCATEGORY,
        description: `Club Change Request: ${club.name} - ${changeData.changeType}`,
        approvalPeriod: 'one_time',
        policyWithinSgtu: true,
        amountRequired: false,
        status: 'pending',
        createdById,
        metadata: {
          dswModule: 'club_change_request',
          clubId: club.id,
          clubName: club.name,
          changeType: changeData.changeType,
          requestedChanges: changeData.requestedChanges,
          justification: changeData.justification,
          submittedAt: new Date().toISOString(),
        },
        points: {
          create: [
            {
              sortOrder: 1,
              content: `Club: ${club.name} (${club.clubId})`,
            },
            {
              sortOrder: 2,
              content: `Change Type: ${changeData.changeType}`,
            },
            {
              sortOrder: 3,
              content: `Justification: ${changeData.justification}`,
            },
          ],
        },
      },
    });

    // Create change request record
    const changeRequest = await prisma.clubChangeRequest.create({
      data: {
        clubId,
        notingId: noting.id,
        changeType: changeData.changeType,
        requestedChanges: changeData.requestedChanges,
        justification: changeData.justification,
        status: 'pending',
        requestedById: createdById,
      },
      include: {
        club: true,
        noting: true,
        requestedBy: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return { noting, changeRequest };
  } catch (error) {
    console.error('Error creating club change request noting:', error);
    throw error;
  }
}

module.exports = {
  processApprovedClubCreationNoting,
  createClubCreationNoting,
  createClubChangeRequestNoting,
  extractClubDataFromNoting,
};
