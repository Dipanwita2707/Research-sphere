/**
 * DSW Club Controller
 * Handles HTTP requests for club operations
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Statistics endpoint cached for 5 minutes (avoids 8 parallel DB queries per dashboard load)
 * - Cache invalidated on any club mutation (create, update, member add/remove)
 */

const clubService = require("../services/clubService");
const cache = require("../../../shared/config/redis");
const notingIntegrationService = require("../services/notingIntegrationService");

// Cache key constants
const DSW_STATS_CACHE_KEY = "dsw:statistics:v1";
const DSW_STATS_TTL = 5 * 60; // 5 minutes

const DSW_CLUB_TTL = 2 * 60; // 2 minutes — per-club detail cache
const DSW_MY_CLUBS_TTL = 60; // 1 minute  — per-user "my clubs" list cache

/** Cache key for a single club's full detail */
const _clubCacheKey = (clubId) => `dsw:club:${clubId}`;

/** Cache key for a user's paginated "my clubs" list */
const _myClubsCacheKey = (userId, page, limit) =>
  `dsw:clubs:my:${userId}:p${page}:l${limit}`;

/** Pattern to wipe ALL paginated pages of a user's "my clubs" cache */
const _myClubsPattern = (userId) => `dsw:clubs:my:${userId}:*`;
const {
  SuccessMessages,
  ErrorMessages,
  DSWNotingConfig,
} = require("../constants");
const prisma = require("../../../shared/config/database");

/**
 * Get all clubs with filtering
 * GET /api/dsw/clubs
 */
async function getClubs(req, res) {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      categoryId: req.query.categoryId,
      search: req.query.search,
      academicSession: req.query.academicSession,
      myClubs: req.query.myClubs === "true",
    };

    const result = await clubService.getClubs(filters, req.user);

    res.json({
      success: true,
      data: result.clubs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in getClubs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clubs",
      error: error.message,
    });
  }
}

/**
 * Get club by ID
 * GET /api/dsw/clubs/:clubId
 */
async function getClubById(req, res) {
  try {
    const { clubId } = req.params;

    // Serve from cache when available
    const cacheKey = _clubCacheKey(clubId);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const club = await clubService.getClubById(clubId, req.user);

    // Cache the result
    await cache.set(cacheKey, club, DSW_CLUB_TTL);

    res.json({
      success: true,
      data: club,
    });
  } catch (error) {
    console.error("Error in getClubById:", error);
    const status = error.message === ErrorMessages.CLUB_NOT_FOUND ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Get my clubs (where user is facilitator, chairperson, or member)
 * GET /api/dsw/clubs/my
 */
async function getMyClubs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Serve from per-user cache when available
    const cacheKey = _myClubsCacheKey(req.user.id, page, limit);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached.clubs,
        pagination: cached.pagination,
        fromCache: true,
      });
    }

    const filters = { page, limit, myClubs: true };
    const result = await clubService.getClubs(filters, req.user);

    // Cache the result
    await cache.set(cacheKey, result, DSW_MY_CLUBS_TTL);

    res.json({
      success: true,
      data: result.clubs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in getMyClubs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your clubs",
      error: error.message,
    });
  }
}

/**
 * Add member to club
 * POST /api/dsw/clubs/:clubId/members
 */
async function addMember(req, res) {
  try {
    const { clubId } = req.params;
    const { studentId, role } = req.body;

    const member = await clubService.addMember(
      clubId,
      studentId,
      req.user.id,
      role || "volunteer",
      req,
    );

    // Invalidate stats + the affected club detail + the new member's "my clubs" list
    const resolvedStudentId = member?.studentId || member?.student?.id;
    await Promise.all([
      _invalidateStatsCache(),
      cache.del(_clubCacheKey(clubId)),
      resolvedStudentId
        ? cache.delPattern(_myClubsPattern(resolvedStudentId))
        : Promise.resolve(),
    ]);

    res.status(201).json({
      success: true,
      message: SuccessMessages.MEMBER_ADDED,
      data: member,
    });
  } catch (error) {
    console.error("Error in addMember:", error);
    const status =
      error.message === ErrorMessages.CLUB_NOT_FOUND
        ? 404
        : error.message === ErrorMessages.DUPLICATE_MEMBER
          ? 409
          : error.message === ErrorMessages.INVALID_MEMBER
            ? 400
            : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Remove member from club
 * DELETE /api/dsw/clubs/:clubId/members/:memberId
 */
async function removeMember(req, res) {
  try {
    const { clubId, memberId } = req.params;
    const { reason } = req.body;

    const member = await clubService.removeMember(
      clubId,
      memberId,
      req.user.id,
      reason,
      req,
    );

    // Invalidate stats + club detail + the removed member's "my clubs" list
    const removedStudentId = member?.studentId || member?.student?.id;
    await Promise.all([
      _invalidateStatsCache(),
      cache.del(_clubCacheKey(clubId)),
      removedStudentId
        ? cache.delPattern(_myClubsPattern(removedStudentId))
        : Promise.resolve(),
    ]);

    res.json({
      success: true,
      message: SuccessMessages.MEMBER_REMOVED,
      data: member,
    });
  } catch (error) {
    console.error("Error in removeMember:", error);
    const status = error.message === ErrorMessages.MEMBER_NOT_FOUND ? 404 : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Get club members
 * GET /api/dsw/clubs/:clubId/members
 */
async function getClubMembers(req, res) {
  try {
    const { clubId } = req.params;
    const club = await clubService.getClubById(clubId, req.user);

    res.json({
      success: true,
      data: club.members,
      count: club._count.members,
    });
  } catch (error) {
    console.error("Error in getClubMembers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch club members",
      error: error.message,
    });
  }
}

/**
 * Update club editable fields
 * PATCH /api/dsw/clubs/:clubId
 */
async function updateClub(req, res) {
  try {
    const { clubId } = req.params;
    const updates = req.body;

    const club = await clubService.updateClubEditableFields(
      clubId,
      updates,
      req.user.id,
      req,
    );

    // Club data changed — invalidate stats + cached club detail
    await Promise.all([
      _invalidateStatsCache(),
      cache.del(_clubCacheKey(clubId)),
    ]);

    res.json({
      success: true,
      message: SuccessMessages.CLUB_UPDATED,
      data: club,
    });
  } catch (error) {
    console.error("Error in updateClub:", error);
    const status =
      error.message === ErrorMessages.CLUB_NOT_FOUND
        ? 404
        : error.message === ErrorMessages.IMMUTABLE_FIELD_UPDATE
          ? 403
          : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Update a member's role
 * PATCH /api/dsw/clubs/:clubId/members/:memberId/role
 */
async function updateMemberRole(req, res) {
  try {
    const { clubId, memberId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res
        .status(400)
        .json({ success: false, message: "Role is required" });
    }

    const member = await clubService.updateMemberRole(
      clubId,
      memberId,
      role,
      req.user.id,
      req,
    );

    // Invalidate club cache so member list refreshes
    await Promise.all([
      cache.del(_clubCacheKey(clubId)),
      _invalidateStatsCache(),
    ]);

    res.json({
      success: true,
      message: "Member role updated successfully",
      data: member,
    });
  } catch (error) {
    console.error("Error in updateMemberRole:", error);
    const status =
      error.message === ErrorMessages.MEMBER_NOT_FOUND
        ? 404
        : error.message === ErrorMessages.CLUB_NOT_FOUND
          ? 404
          : 500;
    res.status(status).json({ success: false, message: error.message });
  }
}

/**
 * Get club statistics
 * GET /api/dsw/statistics
 *
 * Cached for 5 minutes — the 8 parallel DB queries only run on cache miss.
 */
async function getStatistics(req, res) {
  try {
    // Try cache first
    const cached = await cache.get(DSW_STATS_CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const stats = await clubService.getClubStatistics();

    // Store in cache
    await cache.set(DSW_STATS_CACHE_KEY, stats, DSW_STATS_TTL);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error in getStatistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
}

/** Helper: invalidate stats cache after any mutation that changes club counts */
async function _invalidateStatsCache() {
  await cache.del(DSW_STATS_CACHE_KEY);
}

/**
 * Create a new club (via noting workflow)
 * Student fills club creation form → Noting created → Goes to DSW for approval → Club created on approval
 * POST /api/dsw/clubs
 */
async function createClub(req, res) {
  try {
    // Validate user is a student
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can create clubs",
      });
    }

    const clubData = req.body;

    // Create noting with club data (similar to event creation)
    const noting = await notingIntegrationService.createClubCreationNoting(
      clubData,
      req.user.id,
    );

    // Invalidate stats cache — pending approvals count changed
    await _invalidateStatsCache();

    res.status(201).json({
      success: true,
      message:
        "Club creation noting submitted successfully. Awaiting approval from DSW.",
      data: {
        noting: {
          id: noting.id,
          notingId: noting.notingId,
          status: noting.status,
          clubName: noting.clubName,
          createdAt: noting.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Error in createClub:", error);
    const status =
      error.message.includes("duplicate") ||
      error.message.includes("already exists")
        ? 409
        : error.message.includes("Invalid") ||
            error.message.includes("required")
          ? 400
          : 500;

    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Get my club creation requests (pending notings initiated by this student)
 * GET /api/dsw/clubs/my-requests
 */
async function getMyClubRequests(req, res) {
  try {
    if (req.user.role !== "student") {
      return res.json({ success: true, data: [] });
    }

    // Find the student's own userLogin.id for matching clubInitialMembers
    const userId = req.user.id;

    // Also try to find their studentDetails.id for matching clubChairpersonId
    const studentDetails = await prisma.studentDetails.findUnique({
      where: { userLoginId: userId },
      select: { id: true },
    });

    const orConditions = [
      // Student appears as an initial member (new notings always include submitter)
      { clubInitialMembers: { has: userId } },
    ];

    if (studentDetails) {
      // Student appears as chairperson
      orConditions.push({ clubChairpersonId: studentDetails.id });
    }

    // ── Fallback for old notings ──────────────────────────────────────────────
    // Before the fix, the student's UUID was never stored in clubInitialMembers.
    // The only trace is in the NoteHistory remarks:
    //   "Club creation request from student (UUID) - ..."
    // Use a raw query to find those note IDs, then include them in the OR.
    try {
      const oldRows = await prisma.$queryRaw`
        SELECT DISTINCT note_id
        FROM note_history
        WHERE remarks LIKE ${"%" + userId + "%"}
      `;
      const oldNoteIds = oldRows.map((r) => r.note_id).filter(Boolean);
      if (oldNoteIds.length > 0) {
        orConditions.push({ id: { in: oldNoteIds } });
      }
    } catch (_) {
      // Raw query failure is non-fatal — continue with primary conditions
    }

    const notings = await prisma.note.findMany({
      where: {
        category: DSWNotingConfig.CATEGORY,
        subcategory: DSWNotingConfig.SUBCATEGORY,
        OR: orConditions,
      },
      include: {
        currentHolder: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: { firstName: true, lastName: true, displayName: true },
            },
            studentLogin: {
              select: { firstName: true, lastName: true, displayName: true },
            },
          },
        },
        history: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { action: true, createdAt: true, remarks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Resolve category names in one batch query
    const categoryIds = [
      ...new Set(notings.map((n) => n.clubCategoryId).filter(Boolean)),
    ];
    const categories =
      categoryIds.length > 0
        ? await prisma.clubCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
    const categoryMap = Object.fromEntries(
      categories.map((c) => [c.id, c.name]),
    );

    const data = notings.map((n) => ({
      id: n.id,
      notingId: n.notingId,
      clubName: n.clubName,
      clubPurpose: n.clubPurpose,
      clubAcademicSession: n.clubAcademicSession,
      clubCategoryId: n.clubCategoryId,
      categoryName: n.clubCategoryId
        ? (categoryMap[n.clubCategoryId] ?? null)
        : null,
      status: n.status,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      currentHolder: n.currentHolder
        ? {
            id: n.currentHolder.id,
            uid: n.currentHolder.uid,
            name:
              n.currentHolder.employeeDetails?.displayName ||
              `${n.currentHolder.employeeDetails?.firstName ?? ""} ${n.currentHolder.employeeDetails?.lastName ?? ""}`.trim() ||
              n.currentHolder.studentLogin?.displayName ||
              `${n.currentHolder.studentLogin?.firstName ?? ""} ${n.currentHolder.studentLogin?.lastName ?? ""}`.trim() ||
              n.currentHolder.uid,
          }
        : null,
      lastAction: n.history[0] ?? null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in getMyClubRequests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your club creation requests",
      error: error.message,
    });
  }
}

/**
 * Patch old club creation notings to include the student's userLogin.id in
 * clubInitialMembers so that getMyClubRequests can find them.
 *
 * This is a one-time repair for notings created before the fix that always
 * stores the submitter's UUID in clubInitialMembers.
 *
 * POST /api/dsw/clubs/my-requests/patch-old
 * Body: { notingId: "DSW-CLB-2026-00001" }   ← optional; patches ALL if omitted
 */
async function patchOldClubRequests(req, res) {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can patch their own club requests",
      });
    }

    const userId = req.user.id;
    const { notingId } = req.body; // optional — target a specific noting

    const whereClause = {
      category: DSWNotingConfig.CATEGORY,
      subcategory: DSWNotingConfig.SUBCATEGORY,
      // Only notings where the student is NOT yet in clubInitialMembers
      NOT: { clubInitialMembers: { has: userId } },
    };

    if (notingId) {
      whereClause.notingId = notingId;
    }

    // Find candidate notings – those whose faculty facilitator's noteHistory
    // remarks mention this student's UUID (written before the fix)
    const candidates = await prisma.note.findMany({
      where: whereClause,
      select: {
        id: true,
        notingId: true,
        clubInitialMembers: true,
        history: {
          select: { remarks: true },
        },
      },
    });

    const patched = [];

    for (const note of candidates) {
      // Check if any history remark mentions this student's userId
      const mentionedInHistory = note.history.some(
        (h) => h.remarks && h.remarks.includes(userId),
      );

      // Also check if this is the specific notingId the user is trying to claim
      const isTargeted = notingId && note.notingId === notingId;

      if (mentionedInHistory || isTargeted) {
        await prisma.note.update({
          where: { id: note.id },
          data: {
            clubInitialMembers: {
              // push is not supported on scalar lists in all Prisma versions,
              // so we set the whole array
              set: [...note.clubInitialMembers, userId],
            },
          },
        });
        patched.push(note.notingId);
      }
    }

    res.json({
      success: true,
      message:
        patched.length > 0
          ? `Patched ${patched.length} noting(s): ${patched.join(", ")}`
          : "No old notings needed patching",
      patched,
    });
  } catch (error) {
    console.error("Error in patchOldClubRequests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to patch old club requests",
      error: error.message,
    });
  }
}

module.exports = {
  createClub,
  getClubs,
  getClubById,
  getMyClubs,
  getMyClubRequests,
  patchOldClubRequests,
  addMember,
  removeMember,
  updateMemberRole,
  getClubMembers,
  updateClub,
  getStatistics,
};
