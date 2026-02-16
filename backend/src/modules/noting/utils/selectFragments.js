/**
 * Reusable Prisma Select Fragments for Note Queries
 * Eliminates duplication and ensures consistency
 */

/**
 * User details with employee and student info
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
 * User info for list views
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
 */
const historyWithUsers = {
  orderBy: { createdAt: 'asc' },
  include: {
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

/**
 * Full note include for detail view
 */
function getFullNoteInclude() {
  return {
    createdBy: {
      select: userWithDetails,
    },
    currentHolder: {
      select: userBasic,
    },
    points: {
      orderBy: { sortOrder: 'asc' },
    },
    history: historyWithUsers,
    attachments: true,
  };
}

/**
 * Note include for list view (optimized - minimal history for approver check, _count for badge)
 */
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
      take: 50, // Minimal data for approver-action check only
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
  getFullNoteInclude,
  getListNoteInclude,
  noteForValidation,
};
