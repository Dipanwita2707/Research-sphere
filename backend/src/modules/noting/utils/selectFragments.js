/**
 * Reusable Prisma Select Fragments for Note Queries
 * ──────────────────────────────────────────────────
 * PERF: All fragments use `select` (NOT `include`) so Prisma only loads the
 * columns we actually need.  The Note table has 50+ columns — most of them
 * event/club metadata that is irrelevant for list views.
 *
 * Every query builder also adds  relationLoadStrategy: "join"  so Prisma
 * emits a single SQL query with JOINs instead of N+1 separate round-trips.
 * On Neon serverless (~50-200ms per round-trip) this alone can save 1-4 seconds.
 */

/**
 * User details with employee and student info (detail view)
 */
const userWithDetails = {
  id: true,
  uid: true,
  email: true,
  role: true,
  employeeDetails: {
    select: {
      firstName: true,
      lastName: true,
      displayName: true,
      empId: true,
      primaryDepartment: {
        select: { departmentName: true },
      },
      primarySchool: {
        select: { facultyName: true },
      },
    },
  },
  studentLogin: {
    select: {
      studentId: true,
      displayName: true,
      program: {
        select: {
          programName: true,
          department: {
            select: {
              departmentName: true,
              faculty: {
                select: { facultyName: true },
              },
            },
          },
        },
      },
      section: {
        select: { sectionCode: true },
      },
    },
  },
};

/**
 * Basic user info (for current holder, etc.)
 */
const userBasic = {
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
};

/**
 * User info for list views — absolute minimum
 */
const userForList = {
  id: true,
  uid: true,
  employeeDetails: {
    select: { displayName: true },
  },
  studentLogin: {
    select: { displayName: true },
  },
};

/**
 * Note history with user details
 * PERF: Capped at 20 rows (was 100). Most notes have < 15 history entries.
 * For notes with very long history, the frontend can paginate via /api/noting/:id/history.
 */
const historyWithUsers = {
  orderBy: { createdAt: "asc" },
  take: 20,
  select: {
    id: true,
    action: true,
    remarks: true,
    createdAt: true,
    performedBy: {
      select: userBasic,
    },
    nextHolder: {
      select: {
        id: true,
        uid: true,
        employeeDetails: {
          select: { displayName: true },
        },
      },
    },
  },
};

// ── Core note field selections ─────────────────────────────────────────────
// List view: only the fields the card/row actually renders
const noteFieldsForList = {
  id: true,
  notingId: true,
  category: true,
  subcategory: true,
  description: true,
  status: true,
  amount: true,
  amountRequired: true,
  approvalPeriod: true,
  createdAt: true,
  updatedAt: true,
};

// Detail view: all business fields, but NOT the 20+ event/club metadata columns
// unless the frontend actually needs them
const noteFieldsForDetail = {
  ...noteFieldsForList,
  recurringFrequency: true,
  policyWithinSgtu: true,
  policyOutsideSgtu: true,
  policyBoth: true,
  policyJustification: true,
  policyCompliant: true,
  currentFlowIndex: true,
  createdById: true,
  currentHolderId: true,
  autoForwardedToManager: true,
  manualForwardReason: true,
  reportingChainHistory: true,
  // Event fields
  eventName: true,
  eventType: true,
  eventStartDate: true,
  eventEndDate: true,
  eventPaymentType: true,
  eventParticipationType: true,
  eventRegistrationFeeIndividual: true,
  eventRegistrationFeeTeam: true,
  eventApproxCapacity: true,
  eventDutyLeaveAvailable: true,
  eventDutyLeaveEligibility: true,
  eventDutyLeaveRoleType: true,
  eventHasSponsorship: true,
  eventSponsors: true,
  eventHasResources: true,
  eventResources: true,
  eventCertification: true,
  eventCapacityFixed: true,
  eventPrizesAwards: true,
  notingEventType: true,
  stallConfig: true,
  festivalMeta: true,
  subEvents: true,
  // Club fields
  clubName: true,
  clubCategoryId: true,
  clubPurpose: true,
  clubAcademicSession: true,
  clubTargetStudentGroup: true,
  clubMeetingFrequency: true,
  clubExpectedActivityTypes: true,
  clubEstimatedAnnualActivityCount: true,
  clubExpectedStudentStrength: true,
  clubFacultyFacilitatorId: true,
  clubChairpersonId: true,
  clubInitialMembers: true,
  clubProposedEmail: true,
  clubSocialMediaHandles: true,
  clubCodeOfConductAccepted: true,
  clubAntiDiscriminationAccepted: true,
};

/**
 * Full note query for detail view — uses select{} + relationLoadStrategy:"join"
 * Returns a complete Prisma query options object (not just the include clause).
 */
function getFullNoteSelect() {
  return {
    relationLoadStrategy: "join",
    select: {
      ...noteFieldsForDetail,
      createdBy: {
        select: userWithDetails,
      },
      currentHolder: {
        select: userBasic,
      },
      points: {
        select: { id: true, content: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
      history: historyWithUsers,
      attachments: {
        select: {
          id: true,
          filePath: true,
          fileName: true,
          fileDescription: true,
        },
      },
    },
  };
}

/**
 * List note query — lean select with relationLoadStrategy:"join"
 * Returns a complete Prisma query options object.
 */
function getListNoteSelect() {
  return {
    relationLoadStrategy: "join",
    select: {
      ...noteFieldsForList,
      createdById: true,
      currentHolderId: true,
      createdBy: {
        select: userForList,
      },
      currentHolder: {
        select: userBasic,
      },
      history: {
        select: { performedById: true },
        take: 1,
      },
      _count: {
        select: {
          history: true,
          attachments: true,
        },
      },
    },
  };
}

// ── Legacy wrappers (kept for backward compatibility) ───────────────────────
// These return include-style objects for callers that haven't migrated yet.
function getFullNoteInclude() {
  return {
    createdBy: {
      select: userWithDetails,
    },
    currentHolder: {
      select: userBasic,
    },
    points: {
      orderBy: { sortOrder: "asc" },
    },
    history: historyWithUsers,
    attachments: true,
  };
}

function getListNoteInclude() {
  return {
    createdBy: {
      select: userForList,
    },
    currentHolder: {
      select: userBasic,
    },
    history: {
      select: { performedById: true },
      take: 1,
    },
    _count: {
      select: {
        history: true,
        attachments: true,
      },
    },
  };
}

/**
 * Minimal note select for validation/authorization checks
 */
const noteForValidation = {
  id: true,
  status: true,
  createdById: true,
  currentHolderId: true,
  currentFlowIndex: true,
  category: true,
  subcategory: true,
  amountRequired: true,
};

module.exports = {
  userWithDetails,
  userBasic,
  userForList,
  historyWithUsers,
  noteFieldsForList,
  noteFieldsForDetail,
  getFullNoteInclude,
  getListNoteInclude,
  getFullNoteSelect,
  getListNoteSelect,
  noteForValidation,
};
