/**
 * DSW Noting Integration Service
 * Handles integration between DSW and Noting system
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Batch-resolve all initialMembers UIDs in ONE query instead of per-member sequential lookups (N+1 fix)
 * - Batch-resolve chairperson + facultyFacilitator lookups in parallel
 * - Reduce sequential awaits to parallel Promise.all where possible
 */

const prisma = require("../../../shared/config/database");
const clubService = require("./clubService");
const { DSWNotingConfig } = require("../constants");
const approvalFlowService = require("../../noting/services/approvalFlow.service");

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
      throw new Error("Invalid noting category for DSW club creation");
    }

    // Create club from approved noting
    // All club data is now stored in Note fields (clubName, clubCategoryId, etc.)
    const club = await clubService.createClubFromNoting(
      noting.id,
      approvedById,
    );

    return club;
  } catch (error) {
    console.error("Error processing approved club creation noting:", error);
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
    "clubName",
    "clubCategoryId",
    "purpose",
    "academicSession",
    "chairpersonId",
    "targetStudentGroup",
    "expectedActivityTypes",
    "meetingFrequency",
    "estimatedAnnualActivityCount",
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
    facultyFacilitatorId: clubData.facultyFacilitatorId || noting.createdById,
    chairpersonId: clubData.chairpersonId,
    targetStudentGroup: clubData.targetStudentGroup,
    expectedActivityTypes: clubData.expectedActivityTypes,
    codeOfConductAccepted: clubData.codeOfConductAccepted === true,
    antiDiscriminationAccepted: clubData.antiDiscriminationAccepted === true,
    meetingFrequency: clubData.meetingFrequency,
    estimatedAnnualActivityCount: parseInt(
      clubData.estimatedAnnualActivityCount,
    ),
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
 * This is called when a student initiates club creation.
 * The noting is assigned to the selected Faculty Facilitator,
 * who then reviews/forwards through the existing approval chain.
 * @param {Object} clubData - Club creation form data
 * @param {string} createdById - Student user ID
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
        notingId: "desc",
      },
    });

    let sequence = 1;
    if (lastNote) {
      const lastSequence = parseInt(lastNote.notingId.split("-")[3]);
      sequence = lastSequence + 1;
    }

    const notingId = `${prefix}${String(sequence).padStart(5, "0")}`;

    // Get category name for description
    let categoryName = "Unknown Category";
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

    const isUUID = (str) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        str,
      );

    // ── Parallel resolution of chairperson + facultyFacilitator ──────────────
    // Instead of sequential awaits we fire both lookups at the same time.
    const rawVcId = clubData.chairpersonId || null;
    const rawFfId = clubData.facultyFacilitatorId || null;

    const [vcLookup, ffLookup] = await Promise.all([
      // Chairperson: look up by studentId (string like "S2024001")
      rawVcId
        ? prisma.studentDetails.findUnique({
            where: { studentId: rawVcId },
            select: { id: true },
          })
        : Promise.resolve(null),
      // Faculty Facilitator: only needs lookup when it is a UID string, not UUID
      rawFfId && !isUUID(rawFfId)
        ? prisma.userLogin.findFirst({
            where: { uid: rawFfId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    // Validate chairperson
    let chairpersonUuid = null;
    if (rawVcId) {
      if (!vcLookup) {
        throw new Error(`Chairperson with Student ID ${rawVcId} not found`);
      }
      chairpersonUuid = vcLookup.id;
    }

    // ── Auto-assign submitting student as Chairperson if not provided ────────
    // The create-club form does not have an explicit chairperson picker —
    // the student who submits the request IS the club chairperson.
    // Without this, noting.clubChairpersonId is NULL and createClubFromNoting
    // throws "Noting must have all required club fields", silently swallowed by
    // the approval controller, so the club is never created even after full approval.
    if (!chairpersonUuid && createdById) {
      const submitterDetails = await prisma.studentDetails.findUnique({
        where: { userLoginId: createdById },
        select: { id: true },
      });
      if (submitterDetails) {
        chairpersonUuid = submitterDetails.id;
        console.log(
          `[createClubCreationNoting] Auto-assigned submitting student (${createdById}) as chairperson (studentDetails.id=${submitterDetails.id})`,
        );
      } else {
        console.warn(
          `[createClubCreationNoting] Could not auto-assign chairperson: no studentDetails found for userLoginId=${createdById}`,
        );
      }
    }

    // Validate faculty facilitator
    let facultyFacilitatorUuid = rawFfId;
    if (rawFfId && !isUUID(rawFfId)) {
      if (!ffLookup) {
        throw new Error(`Faculty Facilitator with UID ${rawFfId} not found`);
      }
      facultyFacilitatorUuid = ffLookup.id;
    }

    // ── Batch-resolve initial members (N+1 fix) ───────────────────────────────
    // Separate the incoming list into already-UUIDs and UIDs that need lookup.
    let resolvedInitialMembers = [];
    if (
      Array.isArray(clubData.initialMembers) &&
      clubData.initialMembers.length > 0
    ) {
      const alreadyUUIDs = [];
      const uidStrings = [];

      for (const m of clubData.initialMembers) {
        if (isUUID(m)) {
          alreadyUUIDs.push(m);
        } else {
          uidStrings.push(m);
        }
      }

      // Single batch query for all non-UUID members
      let uidToIdMap = new Map();
      if (uidStrings.length > 0) {
        const found = await prisma.userLogin.findMany({
          where: { uid: { in: uidStrings } },
          select: { id: true, uid: true },
        });
        for (const u of found) uidToIdMap.set(u.uid, u.id);

        // Warn for any that could not be resolved
        for (const uid of uidStrings) {
          if (!uidToIdMap.has(uid)) {
            console.warn(
              `WARNING: Could not find Initial Member with UID ${uid}`,
            );
          }
        }
      }

      // Build resolved list: UUIDs pass through, UIDs map to their DB id (or fallback)
      for (const m of clubData.initialMembers) {
        if (isUUID(m)) {
          resolvedInitialMembers.push(m);
        } else {
          resolvedInitialMembers.push(uidToIdMap.get(m) ?? m);
        }
      }
    }

    // Always include the submitting student's userLogin.id in clubInitialMembers.
    // This is the only way getMyClubRequests can link a noting back to the
    // student who initiated it, because createdById is set to the faculty
    // facilitator (not the student).
    if (createdById && !resolvedInitialMembers.includes(createdById)) {
      resolvedInitialMembers.push(createdById);
    }

    // Create noting with club data in Note fields (not metadata)
    const noting = await prisma.note.create({
      data: {
        notingId,
        category: DSWNotingConfig.CATEGORY,
        subcategory: DSWNotingConfig.SUBCATEGORY,
        description: `Club Creation Request: ${clubData.name} (${categoryName})`,
        approvalPeriod: "one_time",
        policyWithinSgtu: true,
        amountRequired: false,
        amount: null,
        status: "pending",
        createdById: facultyFacilitatorUuid, // Faculty owns the noting, NOT the student
        currentHolderId: facultyFacilitatorUuid, // Faculty is the initial holder
        // Store club data in Note fields
        clubName: clubData.name,
        clubCategoryId: clubData.categoryId,
        clubPurpose: clubData.purpose,
        clubAcademicSession: clubData.academicSession,
        clubTargetStudentGroup: clubData.targetStudentGroup,
        clubMeetingFrequency: clubData.meetingFrequency,
        clubExpectedActivityTypes: clubData.expectedActivityTypes || [],
        clubEstimatedAnnualActivityCount:
          clubData.estimatedAnnualActivityCount || 0,
        clubExpectedStudentStrength: clubData.expectedStudentStrength || null,
        clubFacultyFacilitatorId: facultyFacilitatorUuid,
        clubChairpersonId: chairpersonUuid,
        clubInitialMembers: resolvedInitialMembers,
        clubProposedEmail: clubData.proposedEmail || null,
        clubSocialMediaHandles: clubData.socialMediaHandles || null,
        clubCodeOfConductAccepted: clubData.codeOfConductAccepted ?? null,
        clubAntiDiscriminationAccepted: clubData.antiDiscriminationAccepted ?? null,
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
              content: `Target Group: ${Array.isArray(clubData.targetStudentGroup) ? clubData.targetStudentGroup.map((g) => g.toUpperCase()).join(", ") : clubData.targetStudentGroup}`,
            },
            {
              sortOrder: 6,
              content: `Expected Activities: ${clubData.expectedActivityTypes.join(", ")}`,
            },
            {
              sortOrder: 7,
              content: `Meeting Frequency: ${clubData.meetingFrequency}`,
            },
            {
              sortOrder: 8,
              content: `Estimated Annual Activities: ${clubData.estimatedAnnualActivityCount || 0}`,
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

    console.log(
      `✅ Club creation noting created: ${notingId} - ${clubData.name}`,
    );

    let creatorInfo = createdById;
    try {
      const creatorUser = await prisma.userLogin.findUnique({
        where: { id: createdById },
        include: {
          studentDetails: true,
          employeeDetails: true,
        },
      });

      if (creatorUser) {
        let name = "";
        if (creatorUser.studentDetails) {
          name =
            `${creatorUser.studentDetails.firstName || ""} ${creatorUser.studentDetails.lastName || ""}`.trim();
        } else if (creatorUser.employeeDetails) {
          name =
            `${creatorUser.employeeDetails.firstName || ""} ${creatorUser.employeeDetails.lastName || ""}`.trim();
        }
        if (!name) name = creatorUser.email?.split("@")[0] || creatorUser.uid;
        creatorInfo = `${name} (${creatorUser.uid})`;
      }
    } catch (_) {}

    // The noting is created directly in the Faculty Facilitator's account.
    // NO auto-forwarding. The Faculty must review and take action
    // (forward/approve/reject) for the workflow to progress.
    // When Faculty forwards, the existing reporting structure resolves normally.
    await prisma.noteHistory.create({
      data: {
        noteId: noting.id,
        action: "SUBMITTED",
        performedById: facultyFacilitatorUuid,
        remarks: `Club creation request from student/user ${creatorInfo} - pending Faculty Facilitator review`,
        nextHolderId: facultyFacilitatorUuid,
      },
    });

    console.log(
      `✅ Noting assigned to Faculty Facilitator ${clubData.facultyFacilitatorId} - awaiting faculty action`,
    );

    return noting;
  } catch (error) {
    console.error("Error creating club creation noting:", error);
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
      throw new Error("Club not found");
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
        notingId: "desc",
      },
    });

    let sequence = 1;
    if (lastNote) {
      const lastSequence = parseInt(lastNote.notingId.split("-")[3]);
      sequence = lastSequence + 1;
    }

    const notingId = `${prefix}${String(sequence).padStart(5, "0")}`;

    // Create noting
    const noting = await prisma.note.create({
      data: {
        notingId,
        category: DSWNotingConfig.CATEGORY,
        subcategory: DSWNotingConfig.SUBCATEGORY,
        description: `Club Change Request: ${club.name} - ${changeData.changeType}`,
        approvalPeriod: "one_time",
        policyWithinSgtu: true,
        amountRequired: false,
        status: "pending",
        createdById,
        metadata: {
          dswModule: "club_change_request",
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
        status: "pending",
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
    console.error("Error creating club change request noting:", error);
    throw error;
  }
}

module.exports = {
  processApprovedClubCreationNoting,
  createClubCreationNoting,
  createClubChangeRequestNoting,
  extractClubDataFromNoting,
};
