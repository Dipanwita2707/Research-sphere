/**
 * Noting Copy Controller
 *
 * Handles post-approval copy sharing and escalation:
 *   - sendCopy      POST /api/noting/:id/send-copy
 *   - replyCopy     POST /api/noting/copy/:copyId/reply
 *   - forwardCopy   POST /api/noting/copy/:copyId/forward
 *   - completeCopy  POST /api/noting/copy/:copyId/complete
 *   - getCopies     GET  /api/noting/:id/copies
 *   - getMyCopies   GET  /api/noting/my-copies
 */

const prisma = require("../../../shared/config/database");
const cache = require("../../../shared/config/redis");
const asyncHandler = require("../../../shared/utils/asyncHandler");
const ApiResponse = require("../../../shared/utils/ApiResponse");
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require("../../../shared/utils/AppError");

const { invalidateNoteCaches } = require("../services/noting.service");
const notingNotification = require("../services/notingNotification.service");

const { createCursorPaginationMeta } = require("../utils/pagination");

// ═══════════════════════════════════════════════════════════════════════════════
// SEND COPY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send copies of an approved note to multiple users
 * Only the creator can send copies after approval
 *
 * @route POST /api/noting/:id/send-copy
 */
const sendCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { userIds, remarks } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory when sending copies");
  }

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new NotFoundError("Note");
  if (note.status !== "approved") {
    throw new ValidationError("Copies can only be sent for approved notes");
  }
  if (note.createdById !== userId) {
    throw new ForbiddenError(
      "Only the creator can send copies of the approved note",
    );
  }

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError("Please select at least one user");
  }

  // Validate all user IDs exist
  const users = await prisma.userLogin.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      uid: true,
      employeeDetails: { select: { displayName: true } },
    },
  });
  if (users.length !== userIds.length) {
    throw new ValidationError("One or more selected users do not exist");
  }

  // Prevent duplicate: check if any of these users already have a root copy for this note
  const existingCopies = await prisma.noteCopy.findMany({
    where: {
      noteId: id,
      assignedToId: { in: userIds },
      rootCopyId: { not: null },
    },
    select: {
      assignedToId: true,
      assignedTo: {
        select: {
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
    distinct: ["assignedToId"],
  });
  if (existingCopies.length > 0) {
    const names = existingCopies
      .map(
        (c) => c.assignedTo?.employeeDetails?.displayName || c.assignedTo?.uid,
      )
      .join(", ");
    throw new ValidationError(
      `Copy already sent to: ${names}. Cannot send duplicate copies to the same user.`,
    );
  }

  // PERF FIX: Merge 3 sequential transactions into 1 interactive transaction.
  // Old: create copies → update rootCopyId → create history (3 round-trips)
  // New: single $transaction(async) does all 3 in 1 round-trip.
  const copies = await prisma.$transaction(async (tx) => {
    // 1. Create copies
    const created = await Promise.all(
      userIds.map((uid) =>
        tx.noteCopy.create({
          data: {
            noteId: id,
            sentById: userId,
            assignedToId: uid,
            remarks: remarks.trim(),
            status: "pending",
            escalationLevel: 0,
          },
          include: {
            assignedTo: {
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: { displayName: true, firstName: true, lastName: true },
                },
              },
            },
          },
        }),
      ),
    );

    // 2. Set rootCopyId = self for each new copy (chain root)
    await Promise.all(
      created.map((c) =>
        tx.noteCopy.update({
          where: { id: c.id },
          data: { rootCopyId: c.id },
        }),
      ),
    );

    // 3. Record in note history
    await tx.noteHistory.create({
      data: {
        noteId: id,
        action: "copy_sent",
        performedById: userId,
        remarks: `Copy sent to ${users.map((u) => u.employeeDetails?.displayName || u.uid).join(", ")}: ${remarks.trim()}`,
      },
    });

    return created;
  });

  await invalidateNoteCaches(id);
  // Trigger notifications: each copy recipient is informed they have been assigned a copy
  notingNotification.notifyCopySent(copies, note);
  return ApiResponse.success(
    res,
    copies,
    `Copy sent to ${copies.length} user(s) successfully`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPLY COPY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reply to an assigned copy (by the assigned user)
 * Remarks mandatory, attachments optional
 *
 * @route POST /api/noting/copy/:copyId/reply
 */
const replyCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { copyId } = req.params;
  const { remarks, attachments } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory when replying");
  }

  const copy = await prisma.noteCopy.findUnique({
    where: { id: copyId },
    include: { note: true },
  });
  if (!copy) throw new NotFoundError("Copy");
  if (copy.assignedToId !== userId) {
    throw new ForbiddenError("Only the assigned user can reply to this copy");
  }
  if (copy.status === "replied") {
    throw new ValidationError(
      "You have already replied. Wait for the noting creator to take action (complete or forward).",
    );
  }

  const [reply] = await prisma.$transaction([
    prisma.noteCopyReply.create({
      data: {
        copyId,
        repliedById: userId,
        remarks: remarks.trim(),
        attachments: attachments || [],
      },
      include: {
        repliedBy: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.noteCopy.update({
      where: { id: copyId },
      data: { status: "replied" },
    }),
  ]);

  await invalidateNoteCaches(copy.note.id);
  // Trigger notification: the copy sender is informed a reply was submitted
  notingNotification.notifyCopyReply(copy);
  return ApiResponse.success(res, reply, "Reply submitted successfully");
});

// ═══════════════════════════════════════════════════════════════════════════════
// FORWARD COPY (ESCALATION)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Forward (re-send) a copy back to the assigned user when work is not complete
 * Triggers escalation:
 *   - 1st re-forward: auto-notifies the assigned user's boss
 *   - 2nd re-forward: auto-notifies the boss's boss
 *   - Continues up the chain
 *
 * @route POST /api/noting/copy/:copyId/forward
 */
const forwardCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { copyId } = req.params;
  const { remarks } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory when forwarding a copy");
  }

  const copy = await prisma.noteCopy.findUnique({
    where: { id: copyId },
    include: {
      note: {
        include: {
          createdBy: {
            select: {
              id: true,
              uid: true,
              employeeDetails: { select: { displayName: true } },
            },
          },
        },
      },
      assignedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
      sentBy: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
  });
  if (!copy) throw new NotFoundError("Copy");
  if (copy.sentById !== userId) {
    throw new ForbiddenError(
      "Only the original sender can forward a copy back",
    );
  }
  if (copy.status !== "replied") {
    throw new ValidationError(
      "Can only escalate after the assignee has replied",
    );
  }

  const newEscalationLevel = copy.escalationLevel + 1;

  // ── Walk hierarchy with a single recursive CTE (N+1 fix) ─────────────────
  // Instead of 2×N sequential queries (one reportingStructure + one userLogin
  // per level), we issue ONE raw SQL query that walks up to `newEscalationLevel`
  // hops in a single round-trip, then fetch the matching userLogin rows in a
  // second (non-sequential) batch query.
  const chainRows = await prisma.$queryRaw`
    WITH RECURSIVE chain AS (
      -- Base case: immediate manager of the assignee
      SELECT rs."manager_id" AS manager_id, 1 AS lvl
      FROM reporting_structure rs
      WHERE rs."user_id" = ${copy.assignedToId}::uuid
        AND rs."is_active" = true
      UNION ALL
      -- Recursive step: walk up one more level
      SELECT rs2."manager_id", chain.lvl + 1
      FROM reporting_structure rs2
      JOIN chain ON rs2."user_id" = chain.manager_id
      WHERE rs2."is_active" = true
        AND chain.lvl < ${newEscalationLevel}
    )
    SELECT manager_id, lvl FROM chain ORDER BY lvl ASC
  `;

  // Batch-fetch display names for all collected manager IDs
  const managerIds = chainRows.map((r) => r.manager_id).filter(Boolean);
  const bossUsers =
    managerIds.length > 0
      ? await prisma.userLogin.findMany({
        where: { id: { in: managerIds } },
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      })
      : [];

  const bossUserMap = new Map(bossUsers.map((u) => [u.id, u]));

  const allBosses = chainRows.map((row) => {
    const u = bossUserMap.get(row.manager_id);
    return {
      id: row.manager_id,
      level: Number(row.lvl),
      name: u?.employeeDetails?.displayName || u?.uid || "Unknown",
    };
  });

  const escalationTargetId =
    allBosses.length > 0 ? allBosses[allBosses.length - 1].id : null;

  const rootCopyId = copy.rootCopyId || copy.id;

  // Update the copy with new escalation level and reset status to pending
  const [updatedCopy] = await prisma.$transaction([
    prisma.noteCopy.update({
      where: { id: copyId },
      data: {
        status: "forwarded",
        escalationLevel: newEscalationLevel,
        escalatedToId: escalationTargetId,
        rootCopyId: rootCopyId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
        escalatedTo: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
      },
    }),
    // Record in note history
    prisma.noteHistory.create({
      data: {
        noteId: copy.noteId,
        action: "copy_forwarded",
        performedById: userId,
        remarks: `Work not completed — forwarded back to ${copy.assignedTo?.employeeDetails?.displayName || copy.assignedTo?.uid}. Escalation Level: ${newEscalationLevel}${allBosses.length > 0 ? ` (${allBosses.map((b) => b.name).join(", ")} notified)` : ""}. Reason: ${remarks.trim()}`,
      },
    }),
  ]);

  // Build escalation chain — a clear narrative of what happened at each level
  // Each entry shows: who was notified, what they were told, that they didn't act
  const previousEscalationCopies = await prisma.noteCopy.findMany({
    where: {
      noteId: copy.noteId,
      escalationLevel: { gt: 0 },
      id: { not: copyId }, // exclude the current copy being forwarded
      assignedToId: { not: copy.assignedToId }, // exclude worker reassigned copies — only boss copies
    },
    orderBy: { escalationLevel: "asc" },
    select: {
      escalationLevel: true,
      remarks: true,
      createdAt: true,
      assignedTo: {
        select: {
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
  });

  // Build chain array — each previous escalation's details
  const escalationChain = previousEscalationCopies.map((ec) => {
    let escRemarks = ec.remarks;
    try {
      const p = JSON.parse(ec.remarks);
      if (p.senderRemarks) escRemarks = p.senderRemarks;
    } catch {
      /* raw string */
    }
    const bossName =
      ec.assignedTo?.employeeDetails?.displayName ||
      ec.assignedTo?.uid ||
      "Unknown";
    return {
      level: ec.escalationLevel,
      notifiedPerson: bossName,
      creatorRemarks: escRemarks,
      date: ec.createdAt,
      actionTaken: false, // they didn't act, that's why we're escalating again
    };
  });

  const creatorName =
    copy.note?.createdBy?.employeeDetails?.displayName ||
    copy.note?.createdBy?.uid ||
    "Unknown";
  const assigneeName =
    copy.assignedTo?.employeeDetails?.displayName ||
    copy.assignedTo?.uid ||
    "Unknown";
  const senderName =
    copy.sentBy?.employeeDetails?.displayName || copy.sentBy?.uid || "Unknown";
  const escalationTargetName =
    allBosses.length > 0 ? allBosses[allBosses.length - 1].name : "Unknown";
  const immediateBossName = allBosses.length > 0 ? allBosses[0].name : null;

  // Add system warning per spec: "Work marked completed but not verified. Please resolve immediately."
  const systemWarning =
    newEscalationLevel === 1
      ? "Work marked completed but not verified. Please resolve immediately."
      : `Work not completed after Level ${newEscalationLevel - 1} escalation. Escalated to higher authority.`;

  // Create escalation copies for ALL bosses in the chain (spec Step 5:
  // "Send escalation to: Task Owner, Immediate Boss, Boss's Boss").
  // L1 boss orders worker, L2 boss orders L1 boss, etc.
  for (let bi = 0; bi < allBosses.length; bi++) {
    const boss = allBosses[bi];
    const orderTarget =
      bi === 0
        ? { id: copy.assignedToId, name: assigneeName }
        : { id: allBosses[bi - 1].id, name: allBosses[bi - 1].name };

    const isHighestBoss = boss.level === newEscalationLevel;
    const bossWarning = isHighestBoss
      ? systemWarning
      : `Reminder: Task still pending. Escalated to ${escalationTargetName} (Level ${newEscalationLevel}).`;

    await prisma.noteCopy.create({
      data: {
        noteId: copy.noteId,
        sentById: userId,
        assignedToId: boss.id,
        remarks: JSON.stringify({
          type: "escalation",
          level: boss.level,
          creatorName,
          senderName,
          assigneeName,
          senderRemarks: remarks.trim(),
          systemWarning: bossWarning,
          escalationChain,
          orderTargetId: orderTarget.id,
          orderTargetName: orderTarget.name,
          higherBossesNotified: allBosses
            .filter((b) => b.level > boss.level)
            .map((b) => b.name),
        }),
        status: "pending",
        escalationLevel: boss.level,
        rootCopyId,
      },
    });
  }

  // Copy BACK to assignee — they still need to do the work
  await prisma.noteCopy.create({
    data: {
      noteId: copy.noteId,
      sentById: userId,
      assignedToId: copy.assignedToId,
      remarks: JSON.stringify({
        type: "reassigned",
        level: newEscalationLevel,
        creatorName,
        senderName,
        senderRemarks: remarks.trim(),
        systemWarning,
        bossesNotified: allBosses.map((b) => b.name),
        immediateBossName,
        escalationChain,
      }),
      status: "pending",
      escalationLevel: newEscalationLevel,
      rootCopyId,
    },
  });

  const bossNames = allBosses.map((b) => b.name).join(", ");
  let message = `Copy forwarded back to ${assigneeName}`;
  if (allBosses.length > 0) {
    message += `. Escalation notice sent to ${bossNames}`;
  }

  await invalidateNoteCaches(copy.noteId);
  // Trigger notifications: each manager in the escalation chain is notified
  notingNotification.notifyCopyEscalated(allBosses, copy);
  return ApiResponse.success(res, updatedCopy, message);
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE COPY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete a copy chain — Creator marks work as done
 * Marks all copies in the escalation chain (assignee, boss, boss's boss) as completed
 * Only Creator can mark final completion
 *
 * @route POST /api/noting/copy/:copyId/complete
 */
const completeCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { copyId } = req.params;

  const copy = await prisma.noteCopy.findUnique({
    where: { id: copyId },
    include: {
      note: { select: { id: true, createdById: true } },
      assignedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
  });
  if (!copy) throw new NotFoundError("Copy");
  if (copy.note.createdById !== userId) {
    throw new ForbiddenError("Only the creator can mark work as completed");
  }
  if (copy.status === "completed") {
    throw new ValidationError("This copy is already completed");
  }
  if (copy.status !== "replied") {
    throw new ValidationError(
      "Can only complete a copy after the assignee has replied",
    );
  }

  const rootId = copy.rootCopyId || copy.id;

  // Find all copies in the chain: root or any copy with this rootCopyId
  const chainCopyIds = await prisma.noteCopy
    .findMany({
      where: {
        OR: [{ id: rootId }, { rootCopyId: rootId }],
      },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  await prisma.$transaction([
    prisma.noteCopy.updateMany({
      where: { id: { in: chainCopyIds } },
      data: { status: "completed" },
    }),
    prisma.noteHistory.create({
      data: {
        noteId: copy.noteId,
        action: "copy_completed",
        performedById: userId,
        remarks: `Work completed — marked by creator. Assignee: ${copy.assignedTo?.employeeDetails?.displayName || copy.assignedTo?.uid}. Entire escalation chain closed.`,
      },
    }),
  ]);

  await invalidateNoteCaches(copy.noteId);
  return ApiResponse.success(
    res,
    { completed: chainCopyIds.length },
    "Work marked as completed. Entire escalation chain closed.",
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET COPIES (CREATOR VIEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all copies for a specific note (creator view)
 *
 * @route GET /api/noting/:id/copies
 */
const getCopies = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new NotFoundError("Note");

  // Only the creator can see all copies
  if (note.createdById !== userId) {
    throw new ForbiddenError("Only the creator can view all copies");
  }

  // PERF FIX: Cache copies for 60 seconds. The creator view of copies
  // is read-heavy after approval — this avoids a joined query on every poll.
  const cacheKey = `noting:copies:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return ApiResponse.success(res, cached, "Copies fetched successfully (cached)");
  }

  const copies = await prisma.noteCopy.findMany({
    where: { noteId: id },
    include: {
      assignedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: {
            select: { displayName: true, firstName: true, lastName: true },
          },
        },
      },
      sentBy: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
      rootCopy: {
        select: {
          assignedToId: true,
          assignedTo: {
            select: {
              employeeDetails: { select: { displayName: true } },
              uid: true,
            },
          },
        },
      },
      note: { select: { createdById: true } },
      escalatedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
      replies: {
        include: {
          repliedBy: {
            select: {
              id: true,
              uid: true,
              employeeDetails: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Cache for 60 seconds
  await cache.set(cacheKey, copies, 60);

  return ApiResponse.success(res, copies, "Copies fetched successfully");
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET MY COPIES (ASSIGNEE VIEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get copies assigned to the current user
 *
 * @route GET /api/noting/my-copies
 */
const getMyCopies = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : "";
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : "";

  // Support optional pagination (default: paginated with limit 20)
  const rawPage = parseInt(req.query.page);
  const rawLimit = parseInt(req.query.limit);
  const cursorParam = req.query.cursor || null;  // cursor-based pagination
  const usePagination = !isNaN(rawPage) && !isNaN(rawLimit);
  const useCursorPag = !!cursorParam;
  // Paginated /my-copies is used by the dashboard list and does not need full
  // thread hydration. Keep full thread only for non-paginated detail workflows.
  const includeThreadData = !usePagination && !useCursorPag;
  const page = usePagination ? Math.max(1, rawPage) : null;
  const limit = usePagination || useCursorPag
    ? Math.min(100, Math.max(1, rawLimit || 20))
    : 50; // Default cap even for "all" — prevents unbounded loads
  const skip = usePagination ? (page - 1) * limit : undefined;

  const where = { assignedToId: userId };

  if (status) {
    where.status = status;
  }

  if (category) {
    where.note = {
      ...(where.note || {}),
      category,
    };
  }

  if (search) {
    where.OR = [
      { note: { notingId: { contains: search, mode: "insensitive" } } },
      { note: { description: { contains: search, mode: "insensitive" } } },
      { sentBy: { uid: { contains: search, mode: "insensitive" } } },
      {
        sentBy: {
          employeeDetails: {
            displayName: { contains: search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // ── PERF: Cache my-copies per-user for 30s ─────────────────────────────
  const pagKey = useCursorPag ? `c:${cursorParam}:${limit}` : `${page || "all"}:${limit || "all"}`;
  const filterKey = JSON.stringify({ search, status, category, startDate, endDate });
  const copiesCacheKey = `noting:mycopies:${userId}:${pagKey}:${filterKey}`;
  const cachedCopies = await cache.get(copiesCacheKey);
  if (cachedCopies) {
    return ApiResponse.success(res, cachedCopies, "My copies fetched successfully");
  }

  // ── PERF: Build pagination args + count in parallel ─────────────────────
  const paginationArgs = useCursorPag
    ? { take: limit, skip: 1, cursor: { id: cursorParam } }
    : usePagination
      ? { skip, take: limit }
      : { take: limit };

  // ── PERF: Single query with select{} + relationLoadStrategy:"join" ──────
  // This replaces the old include{} pattern which caused N+1 queries.
  // With "join", Prisma emits ONE SQL query with LEFT JOINs, saving
  // 3-5 Neon serverless round-trips (~50-200ms each = 150-1000ms saved).
  const userDisplaySelect = {
    id: true,
    uid: true,
    employeeDetails: { select: { displayName: true } },
  };

  const [copies, totalCount, managerId] = await Promise.all([
    prisma.noteCopy.findMany({
      where,
      ...paginationArgs,
      relationLoadStrategy: "join",
      select: {
        id: true,
        noteId: true,
        sentById: true,
        assignedToId: true,
        remarks: true,
        status: true,
        escalationLevel: true,
        rootCopyId: true,
        createdAt: true,
        updatedAt: true,
        note: {
          select: {
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
            createdById: true,
            ...(includeThreadData
              ? {
                points: {
                  select: { id: true, content: true, sortOrder: true },
                },
                attachments: {
                  select: {
                    id: true,
                    filePath: true,
                    fileName: true,
                    fileDescription: true,
                  },
                },
              }
              : {}),
            createdBy: {
              select: {
                uid: true,
                employeeDetails: { select: { displayName: true } },
              },
            },
          },
        },
        sentBy: { select: userDisplaySelect },
        rootCopy: { select: { assignedToId: true } },
        ...(includeThreadData
          ? {
            replies: {
              select: {
                id: true,
                copyId: true,
                remarks: true,
                attachments: true,
                createdAt: true,
                repliedBy: { select: userDisplaySelect },
              },
              orderBy: { createdAt: "asc" },
            },
          }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    // Count only when using offset pagination (cursor doesn't need total)
    usePagination
      ? prisma.noteCopy.count({ where })
      : null,
    // Manager ID lookup (tiny indexed query)
    prisma.reportingStructure
      .findUnique({ where: { userId }, select: { managerId: true } })
      .then((r) => r?.managerId || null)
      .catch(() => null),
  ]);

  // ── Pagination metadata ───────────────────────────────────────────────────
  const paginationMeta = useCursorPag
    ? createCursorPaginationMeta(copies, limit)
    : usePagination
      ? { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) }
      : null;

  // Dedupe per chain (rootCopyId), not per noteId.
  // Same note can have me as worker (chain A) AND boss (chain B) — both must stay.
  // When status priority ties, prefer the newer copy (L2 reminder over stale L1).
  const statusPriority = { pending: 0, replied: 1, completed: 2, forwarded: 3 };
  const byChain = new Map();
  for (const c of copies) {
    const key = c.rootCopyId || c.id;
    const curr = byChain.get(key);
    const pCurr = curr ? (statusPriority[curr.status] ?? 4) : 99;
    const pNew = statusPriority[c.status] ?? 4;
    if (
      !curr ||
      pNew < pCurr ||
      (pNew === pCurr && new Date(c.createdAt) > new Date(curr.createdAt))
    ) {
      byChain.set(key, c);
    }
  }
  let dedupedCopies = Array.from(byChain.values());

  // For dashboard list mode, we intentionally skip heavy full-thread hydration.
  // Copy detail page can still request non-paginated data and get full thread.
  if (!includeThreadData) {
    const responseData = {
      copies: dedupedCopies,
      myManagerId: managerId,
      ...(paginationMeta ? { pagination: paginationMeta } : {}),
    };
    await cache.set(copiesCacheKey, responseData, 60);
    return ApiResponse.success(
      res,
      responseData,
      "My copies fetched successfully",
    );
  }

  // For non-paginated detail mode, include full reply/thread context.
  const noteIds = [...new Set(dedupedCopies.map((c) => c.noteId))];

  // ── OPTIMISED FETCH STRATEGY (v2) ───────────────────────────────────────
  // v1 had 4 serial round-trips: count → findMany → allCopiesForNotes → allReplies
  // v2 merges count + findMany + managerId into one parallel batch (above),
  //    then does ONE more query for chain data + replies.
  //    Total: 2 round-trips max (was 4).
  //
  // Uses relationLoadStrategy:"join" + select{} on chain copies so Prisma
  // emits a single SQL with LEFT JOINs instead of N sub-queries.
  // ─────────────────────────────────────────────────────────────────────────

  // PERF FIX: Scope the chain query to only the rootCopyIds that survived
  // deduplication, rather than ALL copies for ALL noteIds. For users involved
  // in many notes, this dramatically reduces the result set.
  const rootCopyIds = [...new Set(dedupedCopies.map((c) => c.rootCopyId || c.id))];

  if (noteIds.length > 0) {
    const userDisplaySelectSmall = {
      employeeDetails: { select: { displayName: true } },
      uid: true,
    };

    // Single round-trip: fetch ALL NoteCopy rows for these notes WITH their replies
    // Using relationLoadStrategy:"join" → 1 SQL query with JOINs
    // PERF FIX: Scope to rootCopyIds from dedup (not all copies of all notes)
    const allCopiesForNotes = await prisma.noteCopy.findMany({
      where: {
        noteId: { in: noteIds },
        OR: [
          { rootCopyId: { in: rootCopyIds } },
          { id: { in: rootCopyIds } },
        ],
      },
      relationLoadStrategy: "join",
      select: {
        id: true,
        noteId: true,
        createdAt: true,
        escalationLevel: true,
        status: true,
        sentById: true,
        assignedToId: true,
        rootCopyId: true,
        remarks: true,
        assignedTo: { select: userDisplaySelectSmall },
        sentBy: { select: userDisplaySelectSmall },
        note: { select: { createdById: true } },
        rootCopy: {
          select: {
            assignedToId: true,
            assignedTo: { select: userDisplaySelectSmall },
          },
        },
        replies: {
          select: {
            id: true,
            copyId: true,
            remarks: true,
            attachments: true,
            createdAt: true,
            repliedBy: {
              select: {
                id: true,
                uid: true,
                employeeDetails: { select: { displayName: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Build O(1) lookup map: copyId → copy data
    const copyMap = new Map(allCopiesForNotes.map((c) => [c.id, c]));

    // Flatten all replies from all copies, attach copy reference
    const allRepliesWithCopy = [];
    for (const copy of allCopiesForNotes) {
      if (copy.replies) {
        for (const reply of copy.replies) {
          allRepliesWithCopy.push({
            ...reply,
            copy: { noteId: copy.noteId, ...copyMap.get(reply.copyId) },
          });
        }
      }
    }

    // Group all replies by noteId
    const repliesByNote = {};
    for (const reply of allRepliesWithCopy) {
      const nid = reply.copy?.noteId;
      if (!nid) continue;
      if (!repliesByNote[nid]) repliesByNote[nid] = [];
      repliesByNote[nid].push(reply);
    }

    // Build chain-by-note from the already-fetched copies (no extra query)
    const chainByNote = {};
    for (const c of allCopiesForNotes) {
      if (!chainByNote[c.noteId]) chainByNote[c.noteId] = [];
      chainByNote[c.noteId].push(c);
    }

    // Attach allReplies + copyChain to every copy card in one pass
    for (const copy of dedupedCopies) {
      const all = repliesByNote[copy.noteId] || [];
      copy.allReplies = all.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      copy.copyChain = chainByNote[copy.noteId] || [];
    }
  }

  const responseData = {
    copies: dedupedCopies,
    myManagerId: managerId,
    ...(paginationMeta ? { pagination: paginationMeta } : {}),
  };
  // Cache for 60 seconds (invalidated on state changes)
  await cache.set(copiesCacheKey, responseData, 60);

  return ApiResponse.success(
    res,
    responseData,
    "My copies fetched successfully",
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  sendCopy,
  replyCopy,
  forwardCopy,
  completeCopy,
  getCopies,
  getMyCopies,
};
