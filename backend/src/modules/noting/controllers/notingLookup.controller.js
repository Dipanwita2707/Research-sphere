/**
 * Noting Lookup Controller
 *
 * Handles read-only configuration / metadata endpoints:
 *   - getConfig              GET /api/noting/config
 *   - previewNotingId        GET /api/noting/preview-id
 *   - getMyCreatorInfo       GET /api/noting/my-creator-info
 *   - getForwardPrograms     GET /api/noting/forward-options/programs
 *   - getForwardUsers        GET /api/noting/forward-options/users
 *   - searchEmployees        GET /api/noting/search-employees
 *   - getMyManager           GET /api/noting/my-manager
 *   - getMyNotingPermissions GET /api/noting/my-permissions
 */

const prisma = require("../../../shared/config/database");
const cache = require("../../../shared/config/redis");
const asyncHandler = require("../../../shared/utils/asyncHandler");
const ApiResponse = require("../../../shared/utils/ApiResponse");
const log = require("../../../shared/utils/logger");
const { NotFoundError } = require("../../../shared/utils/AppError");
const {
  getDefaultPermissions,
  getPermissionKeyVariants,
} = require("../../../shared/config/permissions.config");

const { generateNotingId } = require("../services/notingId.service");
const { CATEGORIES } = require("../config/noting.config");

// ═══════════════════════════════════════════════════════════════════════════════
// GET CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get configuration for frontend
 * Returns categories, subcategories, and dropdown options
 *
 * @route GET /api/noting/config
 * @access Protected
 */
// Config is completely static — cache it for 24 hours so repeated page loads
// do not compute + serialize the same object on every request.
const NOTING_CONFIG_CACHE_KEY = "noting:config:v1";

const getConfig = asyncHandler(async (req, res) => {
  // Try cache first
  const cached = await cache.get(NOTING_CONFIG_CACHE_KEY);
  if (cached) {
    return ApiResponse.success(
      res,
      cached,
      "Configuration fetched successfully",
    );
  }

  const configData = {
    categories: Object.entries(CATEGORIES).map(([key, val]) => ({
      value: key,
      label: val.label,
      subcategories: Object.entries(val.subcategories).map(([k, v]) => ({
        value: k,
        label: v.label,
        idCode: v.idCode,
      })),
    })),
    approvalPeriodOptions: [
      { value: "one_time", label: "One-time" },
      { value: "recurring", label: "Recurring" },
    ],
    recurringFrequencyOptions: [
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "quarterly", label: "Quarterly" },
      { value: "half_yearly", label: "Half-Yearly" },
      { value: "annually", label: "Annually" },
    ],
    eventTypeOptions: [
      { value: "seminar", label: "Seminar" },
      { value: "workshop", label: "Workshop" },
      { value: "fest", label: "Fest" },
      { value: "conference", label: "Conference" },
      { value: "competition", label: "Competition" },
      { value: "cultural", label: "Cultural" },
      { value: "technical", label: "Technical" },
      { value: "sports", label: "Sports" },
      { value: "other", label: "Other" },
    ],
    eventPaymentTypeOptions: [
      { value: "free", label: "Free" },
      { value: "paid", label: "Paid" },
    ],
  };

  // Cache for 24 hours (config never changes at runtime)
  await cache.set(NOTING_CONFIG_CACHE_KEY, configData, cache.CACHE_TTL.CONFIG);

  return ApiResponse.success(
    res,
    configData,
    "Configuration fetched successfully",
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW NOTING ID
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate preview Noting ID
 * Shows user what ID will be generated before submission
 *
 * @route GET /api/noting/preview-id?category=academic&subcategory=events
 * @access Protected
 */
const previewNotingId = asyncHandler(async (req, res) => {
  const { category, subcategory } = req.query;

  // Validation is handled by validator middleware
  const notingId = generateNotingId(category, subcategory);

  return ApiResponse.success(res, { notingId }, "Noting ID generated");
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET MY CREATOR INFO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get creator info for logged-in user
 * Used to display "Created By" section in frontend
 *
 * @route GET /api/noting/my-creator-info
 * @access Protected
 */
const getMyCreatorInfo = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // PERF FIX: Cache creator info for 10 minutes (matches frontend staleTime).
  // Profile data is stable within a session — this avoids a joined DB query
  // on every visit to the create/edit form.
  const cacheKey = `noting:creatorinfo:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return ApiResponse.success(res, cached, "Creator info fetched (cached)");
  }

  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: {
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
          primaryDepartment: { select: { departmentName: true } },
          primarySchool: { select: { facultyName: true } },
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
                  faculty: { select: { facultyName: true } },
                },
              },
            },
          },
          section: { select: { sectionCode: true } },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("User");
  }

  // Build display name
  const name =
    user.employeeDetails?.displayName ||
    [user.employeeDetails?.firstName, user.employeeDetails?.lastName]
      .filter(Boolean)
      .join(" ") ||
    user.studentLogin?.displayName ||
    user.uid;

  const employeeId =
    user.employeeDetails?.empId ?? user.studentLogin?.studentId ?? null;

  // Get department and school
  let department =
    user.employeeDetails?.primaryDepartment?.departmentName ?? null;
  let school = user.employeeDetails?.primarySchool?.facultyName ?? null;

  if (user.role === "student" && user.studentLogin?.program?.department) {
    department = user.studentLogin.program.department.departmentName ?? null;
    school = user.studentLogin.program.department.faculty?.facultyName ?? null;
  }

  const creatorData = {
    name,
    employeeIdOrStudentId: employeeId,
    role: user.role,
    department,
    school,
  };

  // Cache for 10 minutes (600 seconds)
  await cache.set(cacheKey, creatorData, 600);

  return ApiResponse.success(res, creatorData);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET FORWARD PROGRAMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get programs by department (for manual forward dropdown)
 *
 * @route GET /api/noting/forward-options/programs?departmentId=uuid
 * @access Protected
 */
const getForwardPrograms = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  // Validation handled by validator middleware

  const programs = await prisma.program.findMany({
    where: {
      departmentId: String(departmentId),
      isActive: true,
    },
    select: {
      id: true,
      programName: true,
      programCode: true,
    },
    orderBy: { programName: "asc" },
  });

  return ApiResponse.success(res, programs);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET FORWARD USERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get users in department (for manual forward dropdown)
 *
 * @route GET /api/noting/forward-options/users?departmentId=uuid
 * @access Protected
 */
const getForwardUsers = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  // Validation handled by validator middleware

  const users = await prisma.userLogin.findMany({
    where: {
      role: { in: ["faculty", "staff"] },
      employeeDetails: {
        is: { primaryDepartmentId: String(departmentId) },
      },
    },
    select: {
      id: true,
      uid: true,
      role: true,
      employeeDetails: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          empId: true,
        },
      },
    },
    orderBy: { uid: "asc" },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    uid: u.uid,
    role: u.role,
    displayName:
      u.employeeDetails?.displayName ||
      [u.employeeDetails?.firstName, u.employeeDetails?.lastName]
        .filter(Boolean)
        .join(" ") ||
      u.uid,
  }));

  return ApiResponse.success(res, formattedUsers);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Search employees by UID or name (for manual forward)
 *
 * @route GET /api/noting/search-employees?q=searchterm
 * @access Protected
 */
const searchEmployees = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || String(q).trim().length < 2) {
    return ApiResponse.success(res, []);
  }

  const searchTerm = String(q).trim();

  const users = await prisma.userLogin.findMany({
    where: {
      role: "faculty",
      status: "active",
      OR: [
        { uid: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        {
          employeeDetails: {
            displayName: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          employeeDetails: {
            firstName: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          employeeDetails: {
            lastName: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          employeeDetails: {
            empId: { contains: searchTerm, mode: "insensitive" },
          },
        },
      ],
    },
    select: {
      id: true,
      uid: true,
      role: true,
      employeeDetails: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          empId: true,
          primaryDepartment: { select: { departmentName: true } },
          primarySchool: { select: { facultyName: true } },
        },
      },
    },
    take: 15,
    orderBy: { uid: "asc" },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    uid: u.uid,
    role: u.role,
    displayName:
      u.employeeDetails?.displayName ||
      [u.employeeDetails?.firstName, u.employeeDetails?.lastName]
        .filter(Boolean)
        .join(" ") ||
      u.uid,
    empId: u.employeeDetails?.empId || "",
    department: u.employeeDetails?.primaryDepartment?.departmentName || "",
    school: u.employeeDetails?.primarySchool?.facultyName || "",
  }));

  return ApiResponse.success(res, formattedUsers);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET MY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get reporting manager info for preview
 *
 * @route GET /api/noting/my-manager
 * @access Protected
 */
const getMyManager = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const departmentScope = typeof req.query?.departmentScope === 'string'
    ? req.query.departmentScope.trim().toLowerCase()
    : undefined;
  const departmentId = typeof req.query?.departmentId === 'string'
    ? req.query.departmentId.trim()
    : undefined;

  const reportingContext = departmentScope && departmentId
    ? { departmentScope, departmentId }
    : undefined;

  const reportingService = require("../../core/services/reportingStructure.service");
  const manager = await reportingService.getDirectManager(userId, reportingContext);

  if (!manager) {
    return ApiResponse.success(res, null, "No reporting manager found");
  }

  const managerInfo = {
    id: manager.id,
    uid: manager.uid,
    displayName:
      manager.employeeDetails?.displayName ||
      manager.employeeDetails?.firstName ||
      manager.uid,
    empId: manager.employeeDetails?.empId || "",
    department:
      manager.employeeDetails?.primaryDepartment?.departmentName || "",
    school: manager.employeeDetails?.primarySchool?.facultyName || "",
  };

  return ApiResponse.success(res, managerInfo);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET MY NOTING PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the current user's noting action permissions.
 * Used by the frontend to permission-drive the Approval Section UI —
 * only buttons whose corresponding permission is true are rendered.
 *
 * Permission → UI button mapping:
 *   noting_approve      → Approve, Reject (can reject when you can approve), Recommend, Not-Recommend
 *   noting_forward      → Forward (manual + auto)
 *   noting_return       → Revert Back, Reject (can reject when you can revert)
 *   noting_add_comment  → Recommend, Not-Recommend (secondary check, noting_approve is primary)
 *
 * @route  GET /api/noting/my-permissions
 * @access Protected (any authenticated user)
 */
const getMyNotingPermissions = asyncHandler(async (req, res) => {
  const user = req.user; // fully populated by protect middleware

  // No caching — permissions must always reflect the latest admin changes.
  // The protect middleware already caches the user session (with merged role perms)
  // so this endpoint just does a lightweight in-memory iteration.

  // The canonical set of noting permission keys we expose to the frontend.
  const NOTING_PERM_KEYS = [
    "noting_create",
    "noting_view_own",
    "noting_view_department",
    "noting_view_all",
    "noting_approve",
    "noting_forward",
    "noting_return",
    "noting_add_comment",
    "noting_reject",
    "noting_not_recommend",
    // Subcategory-specific approval keys
    "event_approve",
    "dsw_approve_noting",
    "curriculum_approve",
    "exam_approve",
    "infrastructure_approve",
    "accounts_purchase_approve",
    "student_related_approve",
    "non_academic_resources_approve",
    // Event management keys (for chairperson visibility)
    "event_manage_own",
    "event_publish",
    "event_manage_attendance",
    "event_assign_volunteers",
    "event_view_reports",
  ];

  // 1. Start from role-level defaults (e.g. admin always has noting_approve)
  const defaults = getDefaultPermissions(user.role);

  const result = {};

  // Pre-compute combined permission arrays once (avoid re-iterating per key)
  const allDeptPermissions = [
    ...(Array.isArray(user.centralDeptPermissions)
      ? user.centralDeptPermissions
      : []),
    ...(Array.isArray(user.schoolDeptPermissions)
      ? user.schoolDeptPermissions
      : []),
  ];

  for (const key of NOTING_PERM_KEYS) {
    const variants = getPermissionKeyVariants(key);

    if (variants.some((variant) => defaults[variant] === true)) {
      result[key] = true;
      continue;
    }

    // Check all dept permission assignments in one pass
    result[key] = allDeptPermissions.some(
      (dp) =>
        dp.permissions &&
        variants.some((variant) => dp.permissions[variant] === true),
    );
  }

  // ── Club chairperson override for students ──────────────────────────────
  // If the student is a chairperson of an active/approved club,
  // grant noting_create + noting_view_own + attach metadata.
  // PERF FIX: Use pre-cached _chairpersonClub from protect middleware
  // instead of doing prisma.club.findFirst on every request.
  if (user.role === "student" && !result.noting_create) {
    const cachedClub = user._chairpersonClub;
    if (cachedClub) {
      result.noting_create = true;
      result.noting_view_own = true;
      result.isClubChairperson = true;
      result.chairpersonClubId = cachedClub.id;
      result.chairpersonClubName = cachedClub.name;
    }
  }

  return ApiResponse.success(
    res,
    result,
    "Noting permissions fetched successfully",
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET MY FACILITATOR CLUBS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get clubs where the current user is Faculty Facilitator.
 * Used on the "Create Noting" form to optionally associate an event noting
 * with a club — when set, the club's Chairperson automatically receives
 * full event management permissions upon event creation.
 *
 * Only returns active/approved clubs (drafts and rejected clubs are excluded).
 *
 * @route  GET /api/noting/my-facilitator-clubs
 * @access Protected — noting_create
 */
const getMyFacilitatorClubs = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Short cache to avoid hitting DB on every keystroke / re-render (2 min)
  const cacheKey = `noting:facilitator-clubs:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return ApiResponse.success(res, cached, "Facilitator clubs fetched (cached)");
  }

  const clubs = await prisma.club.findMany({
    where: {
      facultyFacilitatorId: userId,
      status: { in: ["approved", "active"] },
    },
    select: {
      id: true,
      clubId: true,
      name: true,
      chairpersonId: true,
      chairperson: {
        select: {
          id: true,
          uid: true,
          studentLogin: {
            select: { displayName: true },
          },
        },
      },
      category: {
        select: { name: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const formatted = clubs.map((c) => ({
    id: c.id,
    clubId: c.clubId,
    name: c.name,
    categoryName: c.category?.name || null,
    chairpersonId: c.chairpersonId,
    chairpersonName: c.chairperson?.studentLogin?.displayName || c.chairperson?.uid || null,
  }));

  await cache.set(cacheKey, formatted, 120); // 2 minutes

  return ApiResponse.success(res, formatted, "Facilitator clubs fetched successfully");
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  getConfig,
  previewNotingId,
  getMyCreatorInfo,
  getForwardPrograms,
  getForwardUsers,
  searchEmployees,
  getMyManager,
  getMyNotingPermissions,
  getMyFacilitatorClubs,
};
