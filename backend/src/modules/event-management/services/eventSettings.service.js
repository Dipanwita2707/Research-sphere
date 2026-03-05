/**
 * Event Settings / Visibility Service
 *
 * Handles all business logic for event visibility configuration,
 * role-based access, student-level granular filtering, and the
 * registration open/close toggle.
 */

const prisma = require('../../../shared/config/database');
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require('../../../shared/utils/AppError');
const { resolveEvent, canManageEvent } = require('../utils/eventHelpers');

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Ensure the caller owns the event (or has manage_all permission).
 * Accepts either (eventId, userId) for legacy callers, or
 * (eventId, userId, user) where user is the full req.user object
 * to check superadmin, event_manage_all, and event-manager roles.
 * Returns the event row.
 */
const assertEventOwner = async (eventId, userId, user) => {
  const event = await resolveEvent(eventId, {
    select: { id: true, createdById: true },
  });

  // Creator always passes
  if (event.createdById === userId) return event;

  // If full user object is provided, check elevated roles
  if (user) {
    // Superadmin bypasses all
    if (user.role === 'superadmin') return event;

    // Check explicit event_manage_all permission
    const hasManageAll = (user.centralDeptPermissions || []).some(
      dp => dp.permissions && (dp.permissions.event_manage_all === true || dp.permissions.event_event_manage_all === true)
    );
    if (hasManageAll) return event;
  }

  // Check if user is an assigned event manager (volunteer with manager role)
  const isManager = await canManageEvent(prisma, event.id, userId);
  if (isManager) return event;

  throw new ForbiddenError('You do not have permission to manage this event');
};

/**
 * Normalise an incoming JSON array field – always return a plain JS array
 */
const toArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
};

const VALID_ROLES = ['student', 'faculty', 'staff', 'admin', 'parent', 'superadmin'];

// ── Service Functions ──────────────────────────────────────────────

/**
 * Get event visibility settings (or create defaults if none exist yet)
 */
const getEventSettings = async (eventId, userId, user) => {
  const event = await assertEventOwner(eventId, userId, user);

  let visibility = await prisma.eventVisibility.findUnique({
    where: { eventId: event.id },
  });

  // If no settings have been configured yet, auto-create sensible defaults
  if (!visibility) {
    visibility = await prisma.eventVisibility.create({
      data: {
        eventId: event.id,
        isActive: true,
        visibleToRoles: ['student', 'faculty', 'staff', 'admin', 'superadmin', 'parent'],
        studentFilterType: 'all',
        allowedSchoolIds: [],
        allowedDepartmentIds: [],
        allowedProgramIds: [],
        allowedBatchYears: [],
        allowedSectionIds: [],
      },
    });
  }

  return visibility;
};

/**
 * Update event visibility settings
 */
const updateEventSettings = async (eventId, userId, data, user) => {
  const event = await assertEventOwner(eventId, userId, user);

  // Build the update payload — only touch what was sent
  const updateData = {};

  if (data.isActive !== undefined) {
    updateData.isActive = Boolean(data.isActive);
  }

  if (data.visibleToRoles !== undefined) {
    const roles = toArray(data.visibleToRoles).filter((r) => VALID_ROLES.includes(r));
    if (roles.length === 0) {
      throw new ValidationError('At least one visible role must be selected');
    }
    updateData.visibleToRoles = roles;
  }

  if (data.studentFilterType !== undefined) {
    if (!['all', 'custom'].includes(data.studentFilterType)) {
      throw new ValidationError('studentFilterType must be "all" or "custom"');
    }
    updateData.studentFilterType = data.studentFilterType;
  }

  if (data.allowedSchoolIds !== undefined) updateData.allowedSchoolIds = toArray(data.allowedSchoolIds);
  if (data.allowedDepartmentIds !== undefined) updateData.allowedDepartmentIds = toArray(data.allowedDepartmentIds);
  if (data.allowedProgramIds !== undefined) updateData.allowedProgramIds = toArray(data.allowedProgramIds);
  if (data.allowedBatchYears !== undefined) updateData.allowedBatchYears = toArray(data.allowedBatchYears).map(Number).filter(Boolean);
  if (data.allowedSectionIds !== undefined) updateData.allowedSectionIds = toArray(data.allowedSectionIds);

  // Upsert: create if doesn't exist, update otherwise
  const visibility = await prisma.eventVisibility.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      isActive: updateData.isActive ?? true,
      visibleToRoles: updateData.visibleToRoles ?? ['student', 'faculty', 'staff', 'admin', 'superadmin', 'parent'],
      studentFilterType: updateData.studentFilterType ?? 'all',
      allowedSchoolIds: updateData.allowedSchoolIds ?? [],
      allowedDepartmentIds: updateData.allowedDepartmentIds ?? [],
      allowedProgramIds: updateData.allowedProgramIds ?? [],
      allowedBatchYears: updateData.allowedBatchYears ?? [],
      allowedSectionIds: updateData.allowedSectionIds ?? [],
    },
    update: updateData,
  });

  return visibility;
};

/**
 * Toggle registration open/close for the event.
 * isActive = true → registration open, isActive = false → registration closed.
 * This does NOT affect event visibility — only whether users can register.
 *
 * Admin override logic:
 *   - manuallyOverridden = true after any manual toggle
 *   - autoClosed = false (reset — admin is taking back control)
 *
 * Returns the updated visibility record.
 */
const toggleEventActive = async (eventId, userId, user) => {
  const event = await assertEventOwner(eventId, userId, user);

  // Get or create
  let visibility = await prisma.eventVisibility.findUnique({
    where: { eventId: event.id },
  });

  if (!visibility) {
    visibility = await prisma.eventVisibility.create({
      data: {
        eventId: event.id,
        isActive: false,            // creating as closed since user is toggling
        autoClosed: false,
        manuallyOverridden: true,   // admin explicitly chose this state
        visibleToRoles: ['student', 'faculty', 'staff', 'admin', 'superadmin', 'parent'],
        studentFilterType: 'all',
      },
    });
  } else {
    const newIsActive = !visibility.isActive;
    visibility = await prisma.eventVisibility.update({
      where: { eventId: event.id },
      data: {
        isActive: newIsActive,
        autoClosed: false,          // admin is overriding any auto-close
        manuallyOverridden: true,   // mark that admin has taken manual control
      },
    });
    console.log(
      `[EventSettings] Admin ${userId} manually ${newIsActive ? 'OPENED' : 'CLOSED'} registration for event ${eventId} (manualOverride=true)`
    );
  }

  return visibility;
};

/**
 * Check if registration is currently open for an event.
 * Returns true if open, false if closed.
 *
 * Auto-close logic:
 *   - If registrationEndDate has passed AND admin has NOT manually overridden →
 *     automatically set isActive = false, autoClosed = true (one-time action).
 *   - If manuallyOverridden = true → respect admin decision regardless of date.
 */
const isRegistrationOpen = async (eventId) => {
  // Fetch event and visibility in parallel instead of sequentially
  const [event, visibility] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, registrationEndDate: true },
    }),
    prisma.eventVisibility.findUnique({
      where: { eventId },
      select: { isActive: true, autoClosed: true, manuallyOverridden: true },
    }),
  ]);

  // No visibility record → registration open by default (legacy)
  if (!visibility) return true;

  // ── Auto-close logic ──────────────────────────────────────────
  // If end date has passed and admin has not manually overridden, auto-off.
  if (
    event?.registrationEndDate &&
    new Date() > new Date(event.registrationEndDate) &&
    !visibility.manuallyOverridden &&
    visibility.isActive   // only update if currently open (prevent repeated DB writes)
  ) {
    await prisma.eventVisibility.update({
      where: { eventId },
      data: { isActive: false, autoClosed: true },
    });
    console.log(`[EventSettings] Auto-closed registration for event ${eventId} — registrationEndDate passed`);
    return false;
  }

  return visibility.isActive;
};

// ── Visibility Check (used by middleware & listing queries) ────────

/**
 * Check if a specific user can see a specific event.
 * Returns true/false.
 *
 * This is the CORE enforcement function.
 */
const canUserSeeEvent = async (eventId, userId) => {
  // Fetch visibility settings and user in parallel
  const [visibility, user] = await Promise.all([
    prisma.eventVisibility.findUnique({
      where: { eventId },
    }),
    prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        studentLogin: {
          select: {
            id: true,
            programId: true,
            sectionId: true,
            program: {
              select: {
                id: true,
                departmentId: true,
                department: {
                  select: { id: true, facultyId: true },
                },
              },
            },
            section: {
              select: { id: true, batchYear: true },
            },
          },
        },
      },
    }),
  ]);

  // No visibility record → event is visible to everyone (legacy / no config)
  if (!visibility) return true;

  // NOTE: isActive controls registration open/close, NOT event visibility.
  // So we do NOT check isActive here — event is always visible per role/filter config.

  if (!user) return false;

  // Superadmin & event creator always see everything
  if (user.role === 'superadmin') return true;

  // Check if user role is in the allowed roles list
  const allowedRoles = toArray(visibility.visibleToRoles);
  if (!allowedRoles.includes(user.role)) return false;

  // If user is NOT student, role check is sufficient
  if (user.role !== 'student') return true;

  // ── Student granular filtering ────────────────────────────────
  if (visibility.studentFilterType === 'all') return true;

  const student = user.studentLogin;
  if (!student) return false; // student role but no student record

  const allowedSchools = toArray(visibility.allowedSchoolIds);
  const allowedDepts = toArray(visibility.allowedDepartmentIds);
  const allowedProgs = toArray(visibility.allowedProgramIds);
  const allowedBatches = toArray(visibility.allowedBatchYears);
  const allowedSects = toArray(visibility.allowedSectionIds);

  // If no granular filters are set at all, treat as "all"
  const hasAnyFilter = (
    allowedSchools.length > 0 ||
    allowedDepts.length > 0 ||
    allowedProgs.length > 0 ||
    allowedBatches.length > 0 ||
    allowedSects.length > 0
  );
  if (!hasAnyFilter) return true;

  // Check section
  if (allowedSects.length > 0 && student.sectionId) {
    if (allowedSects.includes(student.sectionId)) return true;
  }

  // Check batch year
  if (allowedBatches.length > 0 && student.section?.batchYear) {
    if (allowedBatches.includes(student.section.batchYear)) return true;
  }

  // Check program
  if (allowedProgs.length > 0 && student.programId) {
    if (allowedProgs.includes(student.programId)) return true;
  }

  // Check department
  if (allowedDepts.length > 0 && student.program?.departmentId) {
    if (allowedDepts.includes(student.program.departmentId)) return true;
  }

  // Check school
  if (allowedSchools.length > 0 && student.program?.department?.facultyId) {
    if (allowedSchools.includes(student.program.department.facultyId)) return true;
  }

  // None of the granular filters matched
  return false;
};

/**
 * Build a Prisma WHERE clause that filters events based on visibility for a user.
 * This is used in the event listing query to ensure filtered results at the DB level.
 *
 * Returns an additional AND condition to merge into the listing where clause.
 */
const buildVisibilityFilter = async (userId) => {
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      studentLogin: {
        select: {
          id: true,
          programId: true,
          sectionId: true,
          program: {
            select: {
              id: true,
              departmentId: true,
              department: {
                select: { id: true, facultyId: true },
              },
            },
          },
          section: {
            select: { id: true, batchYear: true },
          },
        },
      },
    },
  });

  if (!user) return { id: 'NONE' }; // block all

  // Superadmin sees everything
  if (user.role === 'superadmin') return {};

  // Build filter: either no visibility record (legacy) OR visibility allows this user
  const roleFilter = {
    OR: [
      // Events with no visibility config (legacy) — visible to all
      { EventVisibility: null },
      // Events explicitly turned off → exclude
      // Events where role is allowed
      {
        EventVisibility: {
          isActive: true,
          visibleToRoles: { array_contains: [user.role] },
        },
      },
    ],
  };

  // For non-student users, role check is sufficient
  if (user.role !== 'student') return roleFilter;

  // ── Student: add granular filters ─────────────────────────────
  const student = user.studentLogin;
  const studentMatchConditions = [];

  // "all" students
  studentMatchConditions.push({
    EventVisibility: {
      isActive: true,
      visibleToRoles: { array_contains: ['student'] },
      studentFilterType: 'all',
    },
  });

  // Custom filter – check if student matches any filter
  if (student) {
    const orConditions = [];

    if (student.sectionId) {
      orConditions.push({
        allowedSectionIds: { array_contains: [student.sectionId] },
      });
    }

    if (student.section?.batchYear) {
      orConditions.push({
        allowedBatchYears: { array_contains: [student.section.batchYear] },
      });
    }

    if (student.programId) {
      orConditions.push({
        allowedProgramIds: { array_contains: [student.programId] },
      });
    }

    if (student.program?.departmentId) {
      orConditions.push({
        allowedDepartmentIds: { array_contains: [student.program.departmentId] },
      });
    }

    if (student.program?.department?.facultyId) {
      orConditions.push({
        allowedSchoolIds: { array_contains: [student.program.department.facultyId] },
      });
    }

    if (orConditions.length > 0) {
      studentMatchConditions.push({
        EventVisibility: {
          isActive: true,
          visibleToRoles: { array_contains: ['student'] },
          studentFilterType: 'custom',
          OR: orConditions,
        },
      });
    }
  }

  return {
    OR: [
      // No visibility config (legacy events)
      { EventVisibility: null },
      // Student match conditions
      ...studentMatchConditions,
    ],
  };
};

/**
 * Get hierarchy data for the settings UI (schools, departments, programs, sections)
 * PERF: Cached for 1 hour — hierarchy data rarely changes
 */
const getHierarchyData = async () => {
  const cache = require('../../../shared/config/redis');
  const cacheKey = 'events:hierarchy:data';
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const [schools, departments, programs, sections] = await Promise.all([
    prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: { id: true, facultyName: true, facultyCode: true, shortName: true },
      orderBy: { facultyName: 'asc' },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, departmentName: true, departmentCode: true, shortName: true, facultyId: true },
      orderBy: { departmentName: 'asc' },
    }),
    prisma.program.findMany({
      where: { isActive: true },
      select: { id: true, programName: true, programCode: true, shortName: true, departmentId: true },
      orderBy: { programName: 'asc' },
    }),
    prisma.section.findMany({
      where: { status: 'active' },
      select: { id: true, sectionName: true, sectionCode: true, batchYear: true, academicYear: true, programId: true },
      orderBy: [{ batchYear: 'desc' }, { sectionName: 'asc' }],
    }),
  ]);

  // Extract unique batch years from sections
  const batchYearsSet = new Set(sections.map((s) => s.batchYear));
  const batchYears = [...batchYearsSet].sort((a, b) => b - a);

  const result = { schools, departments, programs, sections, batchYears };
  await cache.set(cacheKey, result, 3600); // 1 hour
  return result;
};

module.exports = {
  assertEventOwner,
  getEventSettings,
  updateEventSettings,
  toggleEventActive,
  isRegistrationOpen,
  canUserSeeEvent,
  buildVisibilityFilter,
  getHierarchyData,
};
