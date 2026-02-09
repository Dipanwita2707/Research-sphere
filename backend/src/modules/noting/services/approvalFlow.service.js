/**
 * Resolve next approver for a note based on category, subcategory, creator context, and current step.
 * Uses: HOD (department/school + designation fallback), Dean (school + designation fallback),
 * noting_authority for COE, DAA, Accounts, etc., and existing Central Departments (see /admin/central-departments)
 * for DSW and Central Team — members are users with CentralDepartmentPermission for that department; any one can approve/reject/forward.
 * 
 * NOTE: Students are NO LONGER allowed in noting system. All flows are Faculty/Staff/Admin only.
 */
const prisma = require('../../../shared/config/database');
const {
  getFlowDefinition,
  HOD_DESIGNATION_MATCH,
  DEAN_DESIGNATION_MATCH,
  isCentralDepartmentRole,
  CENTRAL_DEPARTMENT_ROLE_TO_DEPT_CODE,
} = require('../config/noting.config');

const roleKeyMap = {
  DSW: 'DSW',
  COE: 'COE',
  DAA: 'DAA',
  ACCOUNTS_HEAD: 'ACCOUNTS_HEAD',
  PURCHASE_HEAD: 'PURCHASE_HEAD',
  HR_HEAD: 'HR_HEAD',
  CONSTRUCTION_TEAM_HEAD: 'CONSTRUCTION_TEAM_HEAD',
  HIGHER_AUTHORITY: 'HIGHER_AUTHORITY',
  CENTRAL_TEAM: 'CENTRAL_TEAM',
};

/**
 * Get creator's context: departmentId, schoolId (facultyId), role.
 * Students are blocked from noting, so this only handles Faculty/Staff/Admin.
 */
async function getCreatorContext(createdById) {
  const user = await prisma.userLogin.findUnique({
    where: { id: createdById },
    select: {
      id: true,
      role: true,
      employeeDetails: {
        select: {
          primaryDepartmentId: true,
          primarySchoolId: true,
        },
      },
    },
  });
  if (!user) return null;

  let departmentId = null;
  let schoolId = null;

  if (user.employeeDetails) {
    departmentId = user.employeeDetails.primaryDepartmentId;
    schoolId = user.employeeDetails.primarySchoolId;
    if (!schoolId && departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { facultyId: true },
      });
      schoolId = dept?.facultyId ?? null;
    }
  }

  return {
    role: user.role,
    departmentId,
    schoolId,
  };
}

/**
 * Get all user IDs for an authority role. DSW and CENTRAL_TEAM are resolved from existing Central Departments
 * (CentralDepartment + CentralDepartmentPermission at /admin/central-departments). Other roles use noting_authority.
 */
async function getAuthorityMemberIds(roleKey) {
  const deptCode = CENTRAL_DEPARTMENT_ROLE_TO_DEPT_CODE[roleKey];
  if (deptCode) {
    const centralDept = await prisma.centralDepartment.findFirst({
      where: { departmentCode: deptCode, isActive: true },
      select: { id: true },
    });
    if (!centralDept) return [];
    const perms = await prisma.centralDepartmentPermission.findMany({
      where: { centralDeptId: centralDept.id, isActive: true },
      select: { userId: true },
    });
    return perms.map((p) => p.userId);
  }
  const rows = await prisma.notingAuthority.findMany({
    where: { roleKey },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/**
 * Resolve userId for a given authority type in the flow (single user; for non-central roles or first member).
 */
async function resolveAuthorityUserId(authorityType, creatorContext) {
  const ids = await resolveAuthorityUserIds(authorityType, creatorContext);
  return ids.length ? ids[0] : null;
}

/**
 * Resolve user IDs for a given authority type. For central department roles (DSW, CENTRAL_TEAM) returns all members; otherwise single user or empty.
 * MENTOR authority type has been removed - students are not allowed in noting system.
 */
async function resolveAuthorityUserIds(authorityType, creatorContext) {
  if (authorityType === 'HOD' && creatorContext.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: creatorContext.departmentId },
      select: { headOfDepartmentId: true },
    });
    if (dept?.headOfDepartmentId) return [dept.headOfDepartmentId];
    const hodByDesignation = await prisma.userLogin.findFirst({
      where: {
        role: { in: ['faculty', 'staff'] },
        employeeDetails: {
          is: {
            AND: [
              { primaryDepartmentId: creatorContext.departmentId },
              { OR: HOD_DESIGNATION_MATCH.map((d) => ({ designation: { equals: d, mode: 'insensitive' } })) },
            ],
          },
        },
      },
      select: { id: true },
    });
    if (hodByDesignation) return [hodByDesignation.id];
    return [];
  }
  if (authorityType === 'DEAN' && creatorContext.schoolId) {
    const school = await prisma.facultySchoolList.findUnique({
      where: { id: creatorContext.schoolId },
      select: { headOfFacultyId: true },
    });
    if (school?.headOfFacultyId) return [school.headOfFacultyId];
    const deanByDesignation = await prisma.userLogin.findFirst({
      where: {
        role: { in: ['faculty', 'staff'] },
        employeeDetails: {
          is: {
            AND: [
              { primarySchoolId: creatorContext.schoolId },
              { OR: DEAN_DESIGNATION_MATCH.map((d) => ({ designation: { equals: d, mode: 'insensitive' } })) },
            ],
          },
        },
      },
      select: { id: true },
    });
    if (deanByDesignation) return [deanByDesignation.id];
    return [];
  }

  const roleKey = roleKeyMap[authorityType];
  if (!roleKey) return [];

  if (isCentralDepartmentRole(authorityType)) {
    return getAuthorityMemberIds(roleKey);
  }

  const auth = await prisma.notingAuthority.findFirst({
    where: { roleKey },
    select: { userId: true },
  });
  return auth?.userId ? [auth.userId] : [];
}

/**
 * Get the full flow as steps: each step has order, authorityType, and userIds (one or many for central department).
 * noteContext: { amountRequired } e.g. for Infrastructure.
 * Returns array of { order, authorityType, userIds }.
 * NOTE: Students are blocked from noting, so creatorRole is always 'faculty'.
 */
async function getFullFlowSteps(category, subcategory, createdById, noteContext = {}) {
  const creatorContext = await getCreatorContext(createdById);
  if (!creatorContext) return [];

  // All creators are faculty/staff/admin (students are blocked)
  const flow = getFlowDefinition(category, subcategory, 'faculty', noteContext);
  const result = [];

  for (let i = 0; i < flow.length; i++) {
    const authorityType = flow[i];
    const userIds = await resolveAuthorityUserIds(authorityType, creatorContext);
    if (userIds.length) result.push({ order: i + 1, authorityType, userIds });
  }
  return result;
}

/**
 * Get the ordered list of approver user IDs for the full flow (for this note).
 * For central department steps, returns one row per member with same order/authorityType (for backward compat and UI).
 */
async function getFullFlowUserIds(category, subcategory, createdById, noteContext = {}) {
  const steps = await getFullFlowSteps(category, subcategory, createdById, noteContext);
  const result = [];
  for (const step of steps) {
    for (const userId of step.userIds) {
      result.push({ order: step.order, authorityType: step.authorityType, userId });
    }
  }
  return result;
}

/**
 * Get next step info after current flow index. Used when advancing after approve/forward.
 * Returns { nextHolderId, nextFlowIndex, isGroupStep, authorityType }.
 */
async function getNextStepInfo(category, subcategory, createdById, flowIndex, noteContext = {}) {
  const steps = await getFullFlowSteps(category, subcategory, createdById, noteContext);
  const nextStep = steps[flowIndex];
  if (!nextStep) return { nextHolderId: null, nextFlowIndex: null, isGroupStep: false, authorityType: null };

  const isGroupStep = isCentralDepartmentRole(nextStep.authorityType) && nextStep.userIds.length > 0;
  const nextHolderId = isGroupStep ? null : (nextStep.userIds[0] || null);
  return {
    nextHolderId,
    nextFlowIndex: flowIndex,
    isGroupStep,
    authorityType: nextStep.authorityType,
  };
}

/**
 * Check if the given user is allowed to act at the given flow step (either as single holder or as member of central department step).
 */
async function canUserActAtStep(userId, category, subcategory, createdById, flowIndex, noteContext = {}) {
  const steps = await getFullFlowSteps(category, subcategory, createdById, noteContext);
  const step = steps[flowIndex];
  if (!step) return false;
  return step.userIds.includes(userId);
}

/**
 * Batch check if user can act on multiple notes at their current flow steps
 * Optimized to avoid N+1 queries
 * 
 * @param {string} userId - User ID to check authorization for
 * @param {Array} notes - Array of note objects with category, subcategory, createdById, currentFlowIndex, amountRequired
 * @returns {Promise<Map>} Map of noteId => boolean (can act)
 */
async function canUserActAtStepBatch(userId, notes) {
  const results = new Map();

  // Group notes by flow key to minimize flow calculations
  const noteGroups = new Map();

  for (const note of notes) {
    const flowKey = `${note.category}:${note.subcategory}:${note.createdById}:${note.currentFlowIndex}:${note.amountRequired}`;

    if (!noteGroups.has(flowKey)) {
      noteGroups.set(flowKey, []);
    }
    noteGroups.get(flowKey).push(note);
  }

  // Process each unique group once
  for (const [flowKey, groupNotes] of noteGroups) {
    const sampleNote = groupNotes[0];
    const noteContext = { amountRequired: sampleNote.amountRequired === true };

    const canAct = await canUserActAtStep(
      userId,
      sampleNote.category,
      sampleNote.subcategory,
      sampleNote.createdById,
      sampleNote.currentFlowIndex,
      noteContext
    );

    // Apply result to all notes in this group
    for (const note of groupNotes) {
      results.set(note.id, canAct);
    }
  }

  return results;
}

/**
 * Get the next holder (userId) after submission or after current holder approves/forwards.
 * flowIndex: 0-based index in the flow we're at (0 = first approver).
 * For group steps returns null (caller should set currentHolderId = null, currentFlowIndex = flowIndex).
 */
async function getNextHolderId(category, subcategory, createdById, flowIndex, noteContext = {}) {
  const steps = await getFullFlowSteps(category, subcategory, createdById, noteContext);
  const next = steps[flowIndex];
  if (!next) return null;
  if (isCentralDepartmentRole(next.authorityType) && next.userIds.length > 0) return null;
  return next.userIds[0] ?? null;
}

module.exports = {
  getCreatorContext,
  getAuthorityMemberIds,
  getFullFlowUserIds,
  getFullFlowSteps,
  getNextHolderId,
  getNextStepInfo,
  canUserActAtStep,
  canUserActAtStepBatch,
  resolveAuthorityUserId,
  resolveAuthorityUserIds,
};