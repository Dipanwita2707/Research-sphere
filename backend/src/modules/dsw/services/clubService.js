/**
 * DSW Club Service
 * Business logic for club management operations
 */

const prisma = require("../../../shared/config/database");
const {
  ClubStatus,
  ClubLifecycleState,
  ClubMemberApplicationStatus,
  IMMUTABLE_CLUB_FIELDS,
  ErrorMessages,
  SuccessMessages,
} = require("../constants");
const {
  logClubCreation,
  logClubApproval,
  logMemberAdded,
  logMemberRemoved,
  logFieldUpdate,
  createAuditLog,
} = require("../utils/auditLogger");
const { AuditActions } = require("../constants");

/**
 * Generate unique club ID
 * Format: CLB-YYYY-XXXXX
 */
async function generateClubId() {
  const year = new Date().getFullYear();
  const prefix = `CLB-${year}-`;

  // Find the last club created this year
  const lastClub = await prisma.club.findFirst({
    where: {
      clubId: {
        startsWith: prefix,
      },
    },
    orderBy: {
      clubId: "desc",
    },
  });

  let sequence = 1;
  if (lastClub) {
    const lastSequence = parseInt(lastClub.clubId.split("-")[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}${String(sequence).padStart(5, "0")}`;
}

/**
 * Create a new club directly (without noting workflow)
 * This is the direct creation method used when student creates clubs
 * @param {Object} clubData - Club creation data
 * @param {Object} user - User object (student creating the club)
 * @returns {Promise<Object>} Created club
 */
async function createClub(clubData, user) {
  try {
    // Validate required fields
    const requiredFields = [
      "name",
      "categoryId", // This should be the sub-category ID
      "purpose",
      "academicSession",
      "facultyFacilitatorId",
      "chairpersonId",
      "targetStudentGroup",
      "expectedActivityTypes",
      "codeOfConductAccepted",
      "antiDiscriminationAccepted",
      "meetingFrequency",
      "estimatedAnnualActivityCount",
    ];

    for (const field of requiredFields) {
      if (!clubData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate compliance
    if (!clubData.codeOfConductAccepted) {
      throw new Error("Code of Conduct must be accepted");
    }

    if (!clubData.antiDiscriminationAccepted) {
      throw new Error("Anti-Discrimination declaration must be accepted");
    }

    // Check for duplicate club name
    const duplicateClub = await prisma.club.findFirst({
      where: {
        name: {
          equals: clubData.name,
          mode: "insensitive",
        },
      },
    });

    if (duplicateClub) {
      throw new Error(`Club with name "${clubData.name}" already exists`);
    }

    // Validate category (must be sub-category, not main category)
    const category = await prisma.clubCategory.findUnique({
      where: { id: clubData.categoryId },
      include: { parent: true },
    });

    if (!category) {
      throw new Error("Invalid category ID");
    }

    if (!category.parentId) {
      throw new Error(
        "Please select a specific club type (sub-category), not just the main category",
      );
    }

    // Creator must be a student
    if (user.role !== "student") {
      throw new Error("Only students can create clubs");
    }

    // Validate faculty facilitator from request body
    const facultyFacilitator = await prisma.userLogin.findUnique({
      where: { id: clubData.facultyFacilitatorId },
      select: { role: true, uid: true },
    });

    if (!facultyFacilitator || facultyFacilitator.role !== "faculty") {
      throw new Error(ErrorMessages.INVALID_FACILITATOR);
    }

    const facultyFacilitatorId = clubData.facultyFacilitatorId;

    // Validate chairperson
    const chairperson = await prisma.userLogin.findUnique({
      where: { id: clubData.chairpersonId },
      select: { role: true, uid: true },
    });

    if (!chairperson || chairperson.role !== "student") {
      throw new Error("Chairperson must be a student");
    }

    // Generate club ID
    const clubId = await generateClubId();

    // Create club
    const club = await prisma.club.create({
      data: {
        clubId,
        name: clubData.name,
        categoryId: clubData.categoryId,
        purpose: clubData.purpose,
        academicSession: clubData.academicSession,
        facultyFacilitatorId: facultyFacilitatorId,
        chairpersonId: clubData.chairpersonId,
        targetStudentGroup: clubData.targetStudentGroup,
        expectedActivityTypes: clubData.expectedActivityTypes,
        codeOfConductAccepted: clubData.codeOfConductAccepted,
        antiDiscriminationAccepted: clubData.antiDiscriminationAccepted,
        meetingFrequency: clubData.meetingFrequency,
        estimatedAnnualActivityCount: clubData.estimatedAnnualActivityCount,
        proposedEmail: clubData.proposedEmail || null,
        socialMediaHandles: clubData.socialMediaHandles || null,
        expectedStudentStrength: clubData.expectedStudentStrength || null,
        creatorId: user.id,
        status: ClubStatus.ACTIVE, // Direct creation = immediately active
        lifecycleState: ClubLifecycleState.ACTIVE,
        approvedAt: new Date(),
        metadata: clubData.metadata || {},
      },
      include: {
        category: {
          include: {
            parent: true, // Include main category
          },
        },
        facultyFacilitator: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        chairperson: {
          select: {
            id: true,
            uid: true,
            email: true,
          },
        },
      },
    });

    // Add initial members if provided — use createMany for batch efficiency
    if (clubData.initialMembers && clubData.initialMembers.length > 0) {
      const memberData = clubData.initialMembers.map((studentId) => ({
        clubId: club.id,
        studentId: studentId,
        role: "member",
        joinedAt: new Date(),
        addedById: user.id,
        isActive: true,
      }));

      await prisma.clubMember.createMany({
        data: memberData,
        skipDuplicates: true,
      });
    }

    // Create audit log
    await createAuditLog({
      clubId: club.id,
      action: AuditActions.CLUB_CREATED,
      performedById: user.id,
      changes: { club: clubData },
      source: "direct_creation",
      metadata: {
        message: "Club created directly by student",
        creatorId: user.id,
      },
    });

    console.log(`✅ Club created: ${club.clubId} - ${club.name}`);

    return club;
  } catch (error) {
    console.error("Error creating club:", error);
    throw error;
  }
}

/**
 * Create a new club from approved Noting
 * This is called automatically when a club creation noting is approved
 * @param {string} noteId - ID of the approved noting
 * @param {string} userId - User ID who approved
 * @returns {Promise<Object>} Created club
 */
async function createClubFromNoting(noteId, userId) {
  try {
    // Get the noting with club details
    const noting = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        createdBy: true,
      },
    });

    if (!noting) {
      throw new Error("Noting not found");
    }

    // Verify noting is approved
    if (noting.status !== "approved") {
      throw new Error("Noting must be approved before creating club");
    }

    // Validate required club fields in noting
    if (
      !noting.clubName ||
      !noting.clubCategoryId ||
      !noting.clubPurpose ||
      !noting.clubAcademicSession ||
      !noting.clubTargetStudentGroup ||
      !noting.clubMeetingFrequency ||
      !noting.clubFacultyFacilitatorId ||
      !noting.clubChairpersonId
    ) {
      throw new Error("Noting must have all required club fields");
    }

    // Check if club already exists for this noting
    // Parallelize independent validation queries — all can run concurrently
    const [existingClub, duplicateClub, category, facilitator, chairpersonStudent] = await Promise.all([
      // Check existing club for this noting
      prisma.club.findUnique({
        where: { notingId: noteId },
      }),
      // Check for duplicate club name
      prisma.club.findFirst({
        where: {
          name: {
            equals: noting.clubName,
            mode: "insensitive",
          },
        },
      }),
      // Validate category (must be sub-category)
      prisma.clubCategory.findUnique({
        where: { id: noting.clubCategoryId },
        include: { parent: true },
      }),
      // Validate faculty facilitator
      prisma.userLogin.findUnique({
        where: { id: noting.clubFacultyFacilitatorId },
        select: { role: true },
      }),
      // Validate chairperson (noting stores StudentDetails UUID)
      prisma.studentDetails.findUnique({
        where: { id: noting.clubChairpersonId },
        select: {
          id: true,
          userLoginId: true,
          userLogin: {
            select: {
              id: true,
              role: true,
            },
          },
        },
      }),
    ]);

    if (existingClub) {
      throw new Error("Club already created from this noting");
    }

    if (duplicateClub) {
      throw new Error(`Club with name "${noting.clubName}" already exists`);
    }

    if (!category) {
      throw new Error("Invalid category ID");
    }

    if (!category.parentId) {
      throw new Error("Category must be a sub-category (not main category)");
    }

    if (!facilitator || facilitator.role !== "faculty") {
      throw new Error("Faculty facilitator must be a faculty member");
    }

    if (
      !chairpersonStudent ||
      !chairpersonStudent.userLogin ||
      chairpersonStudent.userLogin.role !== "student"
    ) {
      throw new Error("Chairperson must be a student");
    }

    // Get UserLogin UUID for chairperson (Club table expects UserLogin UUID)
    const chairpersonUserLoginId = chairpersonStudent.userLoginId;

    // Generate club ID
    const clubId = await generateClubId();

    // Create club from noting data
    const club = await prisma.club.create({
      data: {
        clubId,
        name: noting.clubName,
        categoryId: noting.clubCategoryId,
        purpose: noting.clubPurpose,
        academicSession: noting.clubAcademicSession,
        facultyFacilitatorId: noting.clubFacultyFacilitatorId,
        chairpersonId: chairpersonUserLoginId, // Use UserLogin UUID
        targetStudentGroup: noting.clubTargetStudentGroup,
        expectedActivityTypes: noting.clubExpectedActivityTypes || [],
        codeOfConductAccepted: true, // Must be accepted to create noting
        antiDiscriminationAccepted: true, // Must be accepted to create noting
        meetingFrequency: noting.clubMeetingFrequency,
        estimatedAnnualActivityCount:
          noting.clubEstimatedAnnualActivityCount || 0,
        proposedEmail: null,
        socialMediaHandles: null,
        expectedStudentStrength: noting.clubExpectedStudentStrength || null,
        creatorId: noting.createdById,
        status: ClubStatus.ACTIVE, // Active after noting approval
        lifecycleState: ClubLifecycleState.ACTIVE,
        notingId: noteId,
        approvedAt: new Date(),
        metadata: {},
      },
      include: {
        category: {
          include: {
            parent: true, // Include main category
          },
        },
        facultyFacilitator: {
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
        chairperson: {
          select: {
            id: true,
            uid: true,
            email: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      clubId: club.id,
      action: AuditActions.CLUB_CREATED,
      performedById: userId,
      changes: { club: { notingId: noteId } },
      source: "noting_approval",
      metadata: {
        message: "Club created from approved noting",
        notingId: noteId,
        approvedBy: userId,
      },
    });

    // Add initial members if any
    if (noting.clubInitialMembers && noting.clubInitialMembers.length > 0) {
      try {
        // clubInitialMembers are already UserLogin UUIDs (resolved at noting-creation time
        // by createClubCreationNoting). The old code incorrectly queried by studentDetails.studentId
        // which always returned 0 rows. Use them directly as ClubMember.studentId.
        const isUUID = (str) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            str,
          );

        // Filter to valid UUIDs only — ignore any legacy non-UUID strings that
        // may exist in old notings (the chairperson is already added as a member
        // separately, so skip duplicates is safe here).
        const memberUUIDs = noting.clubInitialMembers.filter(isUUID);

        // Create ClubMember records directly from the resolved UserLogin UUIDs
        const memberData = memberUUIDs.map((userLoginId) => ({
          clubId: club.id,
          studentId: userLoginId,
          joinedAt: new Date(),
          isActive: true,
          addedById: userId, // Person who approved the noting
          metadata: { source: "initial_member" },
        }));

        if (memberData.length > 0) {
          await prisma.clubMember.createMany({
            data: memberData,
            skipDuplicates: true,
          });

          console.log(
            `✅ Added ${memberData.length} initial members to club ${club.clubId}`,
          );
        }
      } catch (memberError) {
        console.error("Error adding initial members:", memberError);
        // Don't fail the entire club creation if member addition fails
      }
    }

    console.log(`✅ Club created from noting: ${club.clubId} - ${club.name}`);

    return club;
  } catch (error) {
    console.error("Error creating club from noting:", error);
    throw error;
  }
}

/**
 * Get club by ID with full details
 * @param {string} clubId - Club ID
 * @param {Object} user - Current user (for permission checks)
 * @returns {Promise<Object>} Club details
 */
async function getClubById(clubId, user = null) {
  // Keep this first query lean; fetch members/count in parallel to avoid one heavy join query.
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      clubId: true,
      name: true,
      categoryId: true,
      purpose: true,
      academicSession: true,
      facultyFacilitatorId: true,
      chairpersonId: true,
      targetStudentGroup: true,
      expectedActivityTypes: true,
      codeOfConductAccepted: true,
      antiDiscriminationAccepted: true,
      meetingFrequency: true,
      estimatedAnnualActivityCount: true,
      proposedEmail: true,
      socialMediaHandles: true,
      expectedStudentStrength: true,
      status: true,
      lifecycleState: true,
      notingId: true,
      creatorId: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      metadata: true,
      category: {
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      facultyFacilitator: {
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
      chairperson: {
        select: {
          id: true,
          uid: true,
          email: true,
          studentLogin: {
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

  if (!club) {
    throw new Error(ErrorMessages.CLUB_NOT_FOUND);
  }

  const [members, activeMembersCount] = await Promise.all([
    prisma.clubMember.findMany({
      where: {
        clubId,
        isActive: true,
      },
      take: 10,
      orderBy: {
        joinedAt: "asc",
      },
      select: {
        id: true,
        clubId: true,
        studentId: true,
        joinedAt: true,
        isActive: true,
        addedById: true,
        removedAt: true,
        removedById: true,
        metadata: true,
        student: {
          select: {
            id: true,
            uid: true,
            email: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    }),
    prisma.clubMember.count({
      where: {
        clubId,
        isActive: true,
      },
    }),
  ]);

  club.members = members;
  club._count = { members: activeMembersCount };

  // Lift metadata.role onto each member so callers read member.role directly
  if (club.members) {
    club.members = club.members.map(_withRole);
  }

  return club;
}

/**
 * Get all clubs with filtering and pagination
 * @param {Object} filters - Filtering options
 * @param {Object} user - Current user
 * @returns {Promise<Object>} Clubs list with pagination
 */
async function getClubs(filters = {}, user = null) {
  const {
    page = 1,
    limit = 20,
    status = null,
    categoryId = null,
    search = null,
    academicSession = null,
    myClubs = false,
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  // Apply filters
  if (status) {
    where.status = status;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (academicSession) {
    where.academicSession = academicSession;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { purpose: { contains: search, mode: "insensitive" } },
      { clubId: { contains: search, mode: "insensitive" } },
    ];
  }

  // Filter for user's clubs
  if (myClubs && user) {
    where.OR = [
      { facultyFacilitatorId: user.id },
      { chairpersonId: user.id },
      {
        members: {
          some: {
            studentId: user.id,
            isActive: true,
          },
        },
      },
    ];
  }

  const [clubs, total] = await Promise.all([
    prisma.club.findMany({
      where,
      include: {
        category: true,
        facultyFacilitator: {
          select: {
            id: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        chairperson: {
          select: {
            id: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip,
    }),
    prisma.club.count({ where }),
  ]);

  // Lift metadata.role for each member on every club in the list
  const clubsWithRoles = clubs.map((c) => ({
    ...c,
    members: c.members ? c.members.map(_withRole) : c.members,
  }));

  return {
    clubs: clubsWithRoles,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function buildApplicantSnapshot(user) {
  const student = user?.studentLogin;
  const fullName =
    student?.displayName ||
    `${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim() ||
    user?.uid ||
    "Student";

  return {
    applicantName: fullName,
    email: user?.email || null,
    mobileNumber: student?.phone || user?.phone || null,
    program: student?.program?.programName || null,
    course: student?.registrationNo || student?.studentId || null,
  };
}

async function createClubApplication(clubId, applicantId) {
  const [club, applicant, activeMember, existingApplication] = await Promise.all([
    prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, status: true },
    }),
    prisma.userLogin.findUnique({
      where: { id: applicantId },
      select: {
        id: true,
        uid: true,
        email: true,
        phone: true,
        role: true,
        studentLogin: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            registrationNo: true,
            studentId: true,
            phone: true,
            program: {
              select: {
                programName: true,
              },
            },
          },
        },
      },
    }),
    prisma.clubMember.findFirst({
      where: {
        clubId,
        studentId: applicantId,
        isActive: true,
      },
      select: { id: true },
    }),
    prisma.clubMemberApplication.findFirst({
      where: { clubId, applicantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    }),
  ]);

  if (!club) throw new Error(ErrorMessages.CLUB_NOT_FOUND);
  if (club.status !== ClubStatus.ACTIVE) throw new Error(ErrorMessages.CLUB_NOT_ACTIVE);
  if (!applicant || applicant.role !== "student") throw new Error(ErrorMessages.INVALID_MEMBER);
  if (activeMember) throw new Error(ErrorMessages.DUPLICATE_MEMBER);

  if (
    existingApplication &&
    [ClubMemberApplicationStatus.PENDING, ClubMemberApplicationStatus.APPROVED].includes(existingApplication.status)
  ) {
    throw new Error(ErrorMessages.DUPLICATE_APPLICATION);
  }

  const snapshot = buildApplicantSnapshot(applicant);

  let application;
  if (existingApplication && existingApplication.status === ClubMemberApplicationStatus.REJECTED) {
    application = await prisma.clubMemberApplication.update({
      where: { id: existingApplication.id },
      data: {
        ...snapshot,
        status: ClubMemberApplicationStatus.PENDING,
        reviewNote: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
  } else {
    application = await prisma.clubMemberApplication.create({
      data: {
        clubId,
        applicantId,
        ...snapshot,
        status: ClubMemberApplicationStatus.PENDING,
      },
    });
  }

  await createAuditLog({
    clubId,
    action: AuditActions.CLUB_APPLICATION_SUBMITTED,
    performedById: applicantId,
    changes: {
      applicationId: application.id,
      applicantId,
    },
    source: "dsw_ui",
  });

  return application;
}

async function getClubApplications(clubId) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true },
  });
  if (!club) throw new Error(ErrorMessages.CLUB_NOT_FOUND);

  return prisma.clubMemberApplication.findMany({
    where: { clubId },
    include: {
      applicant: {
        select: {
          id: true,
          uid: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          uid: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getMyClubApplications(applicantId) {
  return prisma.clubMemberApplication.findMany({
    where: { applicantId },
    include: {
      club: {
        select: {
          id: true,
          clubId: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function reviewClubApplication(clubId, applicationId, reviewerId, decision, reviewNote = "", req = {}) {
  const application = await prisma.clubMemberApplication.findFirst({
    where: { id: applicationId, clubId },
    include: {
      club: {
        select: {
          id: true,
          status: true,
        },
      },
      applicant: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!application) throw new Error(ErrorMessages.CLUB_APPLICATION_NOT_FOUND);
  if (application.status !== ClubMemberApplicationStatus.PENDING) {
    throw new Error(ErrorMessages.CLUB_APPLICATION_ALREADY_REVIEWED);
  }
  if (application.club.status !== ClubStatus.ACTIVE) throw new Error(ErrorMessages.CLUB_NOT_ACTIVE);

  const targetStatus = decision === "approved"
    ? ClubMemberApplicationStatus.APPROVED
    : ClubMemberApplicationStatus.REJECTED;

  const result = await prisma.$transaction(async (tx) => {
    const updatedApplication = await tx.clubMemberApplication.update({
      where: { id: application.id },
      data: {
        status: targetStatus,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
      },
    });

    let member = null;
    if (targetStatus === ClubMemberApplicationStatus.APPROVED) {
      const existingMembership = await tx.clubMember.findUnique({
        where: {
          clubId_studentId: {
            clubId,
            studentId: application.applicant.id,
          },
        },
      });

      if (existingMembership && !existingMembership.isActive) {
        member = await tx.clubMember.update({
          where: { id: existingMembership.id },
          data: {
            isActive: true,
            joinedAt: new Date(),
            addedById: reviewerId,
            removedAt: null,
            removedById: null,
            metadata: { ...(existingMembership.metadata ?? {}), role: "volunteer" },
          },
        });
      } else if (!existingMembership) {
        member = await tx.clubMember.create({
          data: {
            clubId,
            studentId: application.applicant.id,
            addedById: reviewerId,
            metadata: { role: "volunteer" },
          },
        });
      }
    }

    return { updatedApplication, member };
  });

  await createAuditLog({
    clubId,
    action:
      targetStatus === ClubMemberApplicationStatus.APPROVED
        ? AuditActions.CLUB_APPLICATION_APPROVED
        : AuditActions.CLUB_APPLICATION_REJECTED,
    performedById: reviewerId,
    changes: {
      applicationId: application.id,
      status: targetStatus,
    },
    source: "dsw_ui",
    ipAddress: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return result;
}

/**
 * Add a member to a club
 * @param {string} clubId - Club ID
 * @param {string} studentId - Student user ID
 * @param {string} performedById - User ID who is adding the member
 * @param {Object} req - Request object (for audit)
 * @returns {Promise<Object>} Created club member
 */
async function addMember(
  clubId,
  studentIdentifier,
  performedById,
  role = "volunteer",
  req = {},
) {
  // ── Resolve studentIdentifier → internal UUID ──────────────────────────────
  // The UI lets the operator type a student UID (e.g. "12201501"), an email,
  // or (for programmatic callers) a full UUID.  We normalise here so the rest
  // of the function always works with a UUID primary key.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let studentId = studentIdentifier;

  if (!UUID_RE.test(studentIdentifier)) {
    // Look up by uid (student number) OR email (case-insensitive via Citext)
    const found = await prisma.userLogin.findFirst({
      where: {
        OR: [{ uid: studentIdentifier }, { email: studentIdentifier }],
      },
      select: { id: true, role: true },
    });

    if (!found) {
      throw new Error(
        `No student found with UID or email "${studentIdentifier}"`,
      );
    }

    if (found.role !== "student") {
      throw new Error(ErrorMessages.INVALID_MEMBER);
    }

    studentId = found.id;
  }

  // ── Validate club + student in parallel, then check membership ─────────────
  const [club, student] = await Promise.all([
    prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, status: true, chairpersonId: true },
    }),
    prisma.userLogin.findUnique({
      where: { id: studentId },
      select: { role: true },
    }),
  ]);

  if (!club) {
    throw new Error(ErrorMessages.CLUB_NOT_FOUND);
  }

  if (club.status !== ClubStatus.ACTIVE) {
    throw new Error(ErrorMessages.CLUB_NOT_ACTIVE);
  }

  if (!student || student.role !== "student") {
    throw new Error(ErrorMessages.INVALID_MEMBER);
  }

  // Chairperson cannot be added as a regular member — they are the club head
  if (club.chairpersonId === studentId) {
    throw new Error("Cannot add the Chairperson as a regular member. They already manage this club as its head.");
  }

  // Check if already a member (depends on both validations above passing)
  const existingMember = await prisma.clubMember.findUnique({
    where: {
      clubId_studentId: {
        clubId,
        studentId,
      },
    },
  });

  if (existingMember && existingMember.isActive) {
    throw new Error(ErrorMessages.DUPLICATE_MEMBER);
  }

  // If previously removed, reactivate
  if (existingMember && !existingMember.isActive) {
    const raw = await prisma.clubMember.update({
      where: { id: existingMember.id },
      data: {
        isActive: true,
        joinedAt: new Date(),
        addedById: performedById,
        removedAt: null,
        removedById: null,
        metadata: { ...(existingMember.metadata ?? {}), role },
      },
      include: {
        student: {
          select: {
            id: true,
            uid: true,
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    await logMemberAdded(clubId, performedById, studentId, req);
    return _withRole(raw);
  }

  // Create new member
  const raw = await prisma.clubMember.create({
    data: {
      clubId,
      studentId,
      addedById: performedById,
      metadata: { role },
    },
    include: {
      student: {
        select: {
          id: true,
          uid: true,
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  await logMemberAdded(clubId, performedById, studentId, req);
  return _withRole(raw);
}

/**
 * Update a club member's role (stored in metadata.role)
 * @param {string} clubId - Club ID (for ownership check)
 * @param {string} memberId - ClubMember row ID
 * @param {string} role - New role value
 * @param {string} performedById - User performing the update
 * @param {Object} req - Request object (for audit)
 * @returns {Promise<Object>} Updated member
 */
async function updateMemberRole(
  clubId,
  memberId,
  role,
  performedById,
  req = {},
) {
  const existing = await prisma.clubMember.findUnique({
    where: { id: memberId },
  });

  if (!existing || existing.clubId !== clubId) {
    throw new Error(ErrorMessages.MEMBER_NOT_FOUND);
  }

  if (!existing.isActive) {
    throw new Error(ErrorMessages.MEMBER_NOT_FOUND);
  }

  const raw = await prisma.clubMember.update({
    where: { id: memberId },
    data: {
      metadata: { ...(existing.metadata ?? {}), role },
    },
    include: {
      student: {
        select: {
          id: true,
          uid: true,
          email: true,
          studentLogin: {
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

  await createAuditLog({
    clubId,
    action: AuditActions.FIELD_UPDATED,
    performedById,
    changes: { field: "memberRole", memberId, to: role },
    source: "dsw_ui",
    ipAddress: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return _withRole(raw);
}

/**
 * Lift metadata.role onto the top-level `role` field so the frontend
 * can read member.role without knowing about the metadata pattern.
 * @param {Object} member - Raw Prisma ClubMember object
 * @returns {Object} Member with top-level role field
 */
function _withRole(member) {
  return {
    ...member,
    role: member?.metadata?.role ?? "volunteer",
  };
}

/**
 * Remove a member from a club
 * @param {string} clubId - Club ID
 * @param {string} memberId - Member ID (not student ID)
 * @param {string} performedById - User ID who is removing the member
 * @param {string} reason - Reason for removal
 * @param {Object} req - Request object (for audit)
 * @returns {Promise<Object>} Updated member entry
 */
async function removeMember(
  clubId,
  memberId,
  performedById,
  reason = "",
  req = {},
) {
  const member = await prisma.clubMember.findUnique({
    where: { id: memberId },
    include: {
      club: {
        select: { id: true, chairpersonId: true },
      },
    },
  });

  if (!member || member.clubId !== clubId) {
    throw new Error(ErrorMessages.MEMBER_NOT_FOUND);
  }

  if (!member.isActive) {
    throw new Error("Member is already inactive");
  }

  // Chairperson cannot be removed — they are the club head
  if (member.club.chairpersonId === member.studentId) {
    throw new Error("Cannot remove the Chairperson. They are the head of this club and cannot be deleted.");
  }

  const updatedMember = await prisma.clubMember.update({
    where: { id: memberId },
    data: {
      isActive: false,
      removedAt: new Date(),
      removedById: performedById,
      metadata: {
        ...member.metadata,
        removalReason: reason,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          uid: true,
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  await logMemberRemoved(clubId, performedById, member.studentId, reason, req);
  return updatedMember;
}

/**
 * Update club editable fields (non-immutable)
 * @param {string} clubId - Club ID
 * @param {Object} updates - Fields to update
 * @param {string} performedById - User ID performing the update
 * @param {Object} req - Request object (for audit)
 * @returns {Promise<Object>} Updated club
 */
async function updateClubEditableFields(
  clubId,
  updates,
  performedById,
  req = {},
) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
  });

  if (!club) {
    throw new Error(ErrorMessages.CLUB_NOT_FOUND);
  }

  // Filter to only editable fields
  const allowedUpdates = {};
  const editableFields = [
    "proposedEmail",
    "socialMediaHandles",
    "expectedStudentStrength",
    "metadata",
  ];

  for (const field of editableFields) {
    if (updates[field] !== undefined) {
      allowedUpdates[field] = updates[field];

      // Log each field update
      await logFieldUpdate(
        clubId,
        performedById,
        field,
        club[field],
        updates[field],
        req,
      );
    }
  }

  if (Object.keys(allowedUpdates).length === 0) {
    throw new Error("No valid fields to update");
  }

  const updatedClub = await prisma.club.update({
    where: { id: clubId },
    data: allowedUpdates,
    include: {
      category: true,
      facultyFacilitator: {
        select: {
          id: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      chairperson: {
        select: {
          id: true,
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return updatedClub;
}

/**
 * Check if a field is immutable
 * @param {string} fieldName - Field to check
 * @returns {boolean} True if immutable
 */
function isImmutableField(fieldName) {
  return IMMUTABLE_CLUB_FIELDS.includes(fieldName);
}

/**
 * Get club statistics
 * @returns {Promise<Object>} Statistics
 */
async function getClubStatistics() {
  const [
    totalClubs,
    activeClubs,
    totalMembers,
    totalCategories,
    pendingApprovals,
    clubsByCategory,
    clubsBySession,
    clubsByStatus,
  ] = await Promise.all([
    prisma.club.count(),
    prisma.club.count({ where: { status: ClubStatus.ACTIVE } }),
    prisma.clubMember.count({ where: { isActive: true } }),
    prisma.clubCategory.count(),
    prisma.note.count({
      where: {
        category: "administrative",
        subcategory: "dsw_club_creation",
        status: "pending",
      },
    }),
    prisma.club.groupBy({
      by: ["categoryId"],
      _count: true,
    }),
    prisma.club.groupBy({
      by: ["academicSession"],
      _count: true,
      orderBy: {
        academicSession: "desc",
      },
    }),
    prisma.club.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  const categoryIds = clubsByCategory.map((i) => i.categoryId).filter(Boolean);

  // Fetch all category names in one query (avoid N+1)
  const categoryMap = new Map();
  if (categoryIds.length > 0) {
    const categories = await prisma.clubCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    categories.forEach((c) => categoryMap.set(c.id, c.name));
  }

  const countVal = (item) =>
    typeof item._count === "number"
      ? item._count
      : (item._count?._all ??
        item._count?.categoryId ??
        item._count?.status ??
        0);

  const clubsByCategoryWithNames = clubsByCategory.map((item) => ({
    categoryId: item.categoryId,
    categoryName: categoryMap.get(item.categoryId) || "Unknown",
    _count: countVal(item),
  }));

  return {
    totalClubs,
    activeClubs,
    totalMembers,
    totalCategories,
    pendingApprovals,
    clubsByCategory: clubsByCategoryWithNames,
    clubsBySession,
    clubsByStatus: clubsByStatus.map((item) => ({
      status: item.status,
      _count: countVal(item),
    })),
  };
}

module.exports = {
  generateClubId,
  createClub, // Direct creation without noting
  createClubFromNoting,
  getClubById,
  getClubs,
  createClubApplication,
  getClubApplications,
  getMyClubApplications,
  reviewClubApplication,
  addMember,
  removeMember,
  updateMemberRole,
  updateClubEditableFields,
  isImmutableField,
  getClubStatistics,
};
