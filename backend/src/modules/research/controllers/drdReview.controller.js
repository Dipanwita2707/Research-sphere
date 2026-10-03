const prisma = require('../../../shared/config/database');
const { logIprStatusChange, logIprUpdate } = require('../../../shared/utils/auditLogger');
const { canViewIpr, IPR_ACCESS_INCLUDE } = require('../utils/objectAccess');
const reviewScope = require('../services/reviewScope');
const { IPR_EDITABLE_FIELDS, pickAllowed } = require('../utils/editableFields');
const { IPR_CREDITED_STATUSES, resolveIprPolicy, resolveIprInventors, createIprPayoutLines } = require('../utils/iprIncentive');
const { toNumber, assertWithinCap } = require('../utils/policyMath');

// ── IPR workflow transitions ────────────────────────────────────────────────
// draft → pending_mentor_approval (students) → submitted → under_drd_review
//   → (changes_required → resubmitted) → recommended_to_head → drd_head_approved / submitted_to_govt
//   → govt_application_filed → published (incentives credited) | govt_rejected
// Each DRD action may only start from the statuses listed here. DRD never acts on draft or
// pending_mentor_approval: those belong to the applicant and the mentor.
const DRD_REVIEWABLE_STATUSES = ['submitted', 'under_drd_review', 'resubmitted'];
const IPR_TRANSITIONS = Object.freeze({
  assignReviewer: DRD_REVIEWABLE_STATUSES,
  review: DRD_REVIEWABLE_STATUSES,
  requestChanges: [...DRD_REVIEWABLE_STATUSES, 'recommended_to_head'],
  recommendToHead: DRD_REVIEWABLE_STATUSES,
  finalApproval: [...DRD_REVIEWABLE_STATUSES, 'recommended_to_head', 'drd_head_approved'],
  headApprove: ['recommended_to_head', 'drd_head_approved'],
  finalRejection: [...DRD_REVIEWABLE_STATUSES, 'changes_required', 'recommended_to_head', 'drd_head_approved'],
  govtApplication: ['drd_head_approved', 'submitted_to_govt', 'govt_application_filed'],
  publication: ['govt_application_filed'],
  govtRejected: ['submitted_to_govt', 'govt_application_filed'],
});

const transitionError = (action, currentStatus, allowed) => {
  const err = new Error(currentStatus
    ? `Cannot ${action} an IPR application in status '${currentStatus}'. Allowed from: ${allowed.join(', ')}`
    : `Cannot ${action} this IPR application: its status changed meanwhile (allowed from: ${allowed.join(', ')}). Please refresh and try again.`);
  err.statusCode = 409;
  err.code = 'INVALID_STATUS_TRANSITION';
  return err;
};

/** Sends a 409 for a transition error and returns true; false for any other error. */
const respondIfTransitionError = (res, err) => {
  if (err?.statusCode !== 409) return false;
  res.status(409).json({ success: false, code: err.code, message: err.message });
  return true;
};

const sendInvalidTransition = (res, action, currentStatus, allowed) =>
  respondIfTransitionError(res, transitionError(action, currentStatus, allowed));

/** Atomic status guard: move the application only if it is still in an allowed status. */
const claimIprTransition = async (tx, id, allowed, data, action) => {
  const result = await tx.iprApplication.updateMany({ where: { id, status: { in: allowed } }, data });
  if (result.count !== 1) throw transitionError(action, null, allowed);
};

/** Notifications are sent after commit and never fail the request. */
const safeNotify = (data) => prisma.notification.create({ data }).catch((e) => {
  console.error('IPR notification error:', e);
});

// Non-blocking audit helper
const _auditIprStatus = (application, oldStatus, newStatus, userId, req, comments) => {
  logIprStatusChange(application, oldStatus, newStatus, userId, req, comments).catch(() => {});
};

// Helper function to notify all contributors of an IPR application
const notifyContributors = async (iprApplicationId, notificationType, title, message, additionalMetadata = {}, { excludeUserIds = [] } = {}) => {
  try {
    // Get all contributors for this application
    const rows = await prisma.iprContributor.findMany({
      where: {
        iprApplicationId,
        userId: { not: null }  // Only notify internal users who have accounts
      },
      select: { userId: true, name: true }
    });

    // One notification per user, skipping users already notified by the caller
    const skip = new Set(excludeUserIds);
    const contributors = rows.filter((c) => {
      if (skip.has(c.userId)) return false;
      skip.add(c.userId);
      return true;
    });

    // Create notifications for each contributor
    for (const contributor of contributors) {
      await prisma.notification.create({
        data: {
          userId: contributor.userId,
          type: notificationType,
          title,
          message,
          referenceType: 'ipr_application',
          referenceId: iprApplicationId,
          metadata: additionalMetadata,
        },
      });
    }
    
    return contributors.length;
  } catch (error) {
    console.error('Error notifying contributors:', error);
    return 0;
  }
};

// Get all IPR applications pending for DRD review
// Filters by:
// 1. DRD member's assigned schools (if not DRD Head)
// 2. Applications assigned to current reviewer (for post-approval stages)
const getPendingDrdReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, iprType, schoolId, status } = req.query;
    const userId = req.user.id;

    // Use merged permissions from req.user (includes both direct and role-based permissions)
    let mergedPermissions = {};

    // Merge all DRD permissions from req.user
    if (req.user?.centralDeptPermissions && Array.isArray(req.user.centralDeptPermissions)) {
      req.user.centralDeptPermissions.forEach(deptPerm => {
        if (deptPerm.permissions) {
          Object.assign(mergedPermissions, deptPerm.permissions);
        }
      });
    }
    
    // School scope from the direct DRD row (school assignments are not role-based):
    // empty assignedSchoolIds = all schools, non-empty = only those schools.
    const iprScope = await reviewScope.getSchoolScope(req.user, 'ipr');

    const permissions = mergedPermissions;
    const isDrdHead = permissions.ipr_approve === true || permissions.drd_ipr_approve === true;

    // Build status filter
    // Pending review statuses (for initial review)
    const pendingStatuses = ['submitted', 'under_drd_review', 'resubmitted', 'changes_required'];
    // Recommended statuses (for DRD Head to approve, but DRD Members can also view for tracking)
    const recommendedStatuses = ['recommended_to_head'];
    // Post-approval statuses (for assigned reviewer to update govt filing)
    const postApprovalStatuses = ['drd_head_approved', 'submitted_to_govt', 'govt_application_filed', 'published'];
    // Rejected statuses (for tracking rejected applications)
    const rejectedStatuses = ['drd_rejected', 'drd_head_rejected', 'govt_rejected'];
    // All statuses for DRD Head
    const allStatuses = [...pendingStatuses, ...recommendedStatuses, ...postApprovalStatuses, ...rejectedStatuses, 'completed'];
    // DRD Member statuses - includes recommended and rejected so they can track what they've recommended/rejected
    const memberStatuses = [...pendingStatuses, ...recommendedStatuses, ...rejectedStatuses];

    let statusFilter;
    if (status) {
      statusFilter = [status];
    } else if (isDrdHead) {
      // DRD Head sees all statuses
      statusFilter = allStatuses;
    } else {
      // DRD Member sees pending + recommended (for tracking their recommendations)
      statusFilter = memberStatuses;
    }

    // Build the where clause
    const where = {
      status: { in: statusFilter },
    };

    if (req.tenantId) {
      where.applicantUser = { universityId: req.tenantId };
    }

    // Filter by IPR type if specified
    if (iprType) where.iprType = iprType;

    // School filtering: the explicit ?schoolId filter narrows the reviewer's scope, never widens it.
    // A restricted reviewer also keeps applications the DRD Head assigned to them.
    if (schoolId) where.schoolId = schoolId;
    if (!iprScope.all) {
      where.OR = [
        { schoolId: { in: iprScope.schoolIds } },
        { currentReviewerId: userId },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // OPTIMIZED QUERY - Use select instead of deep includes to reduce data transfer
    const [applications, total] = await Promise.all([
      prisma.iprApplication.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          iprType: true,
          filingType: true,
          projectType: true,
          status: true,
          createdAt: true,
          submittedAt: true,
          // Lean applicant info - only what's needed for list view
          applicantUser: {
            select: {
              uid: true,
              email: true,
              role: true,
              employeeDetails: {
                select: {
                  displayName: true,
                  designation: true,
                  phoneNumber: true,
                },
              },
              studentLogin: {
                select: {
                  displayName: true,
                  registrationNo: true,
                },
              },
            },
          },
          // Basic school/department info
          school: {
            select: {
              id: true,
              facultyName: true,
              facultyCode: true,
            },
          },
          department: {
            select: {
              id: true,
              departmentName: true,
              departmentCode: true,
            },
          },
          // Counts instead of full arrays for better performance
          _count: {
            select: {
              contributors: true,
              sdgs: true,
              reviews: true,
            },
          },
          // Only latest review for list view
          reviews: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              decision: true,
              comments: true,
              createdAt: true,
              reviewer: {
                select: {
                  uid: true,
                  employeeDetails: {
                    select: {
                      displayName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          submittedAt: 'asc',
        },
      }),
      prisma.iprApplication.count({ where }),
    ]);

    const suggestionCounts = applications.length > 0
      ? await prisma.iprEditSuggestion.groupBy({
          by: ['iprApplicationId'],
          where: {
            iprApplicationId: { in: applications.map((application) => application.id) },
            status: 'pending',
          },
          _count: { _all: true },
        })
      : [];

    const suggestionCountMap = new Map(
      suggestionCounts.map((entry) => [entry.iprApplicationId, entry._count._all])
    );
    const enrichedApplications = applications.map((application) => ({
      ...application,
      pendingSuggestionsCount: suggestionCountMap.get(application.id) || 0,
    }));

    res.json({
      success: true,
      data: enrichedApplications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get pending DRD reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reviews',
    });
  }
};

// Assign DRD reviewer to an application
const assignDrdReviewer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerId } = req.body;
    const userId = req.user.id;

    if (!reviewerId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reviewerId',
      });
    }

    // Check if application exists
    const application = await prisma.iprApplication.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    const allowed = IPR_TRANSITIONS.assignReviewer;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'assign a reviewer to', application.status, allowed);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, {
          currentReviewerId: reviewerId,
          status: 'under_drd_review',
        }, 'assign a reviewer to');

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'under_drd_review',
            changedById: userId,
            comments: `Assigned to reviewer: ${reviewerId}`,
          },
        });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Audit: reviewer assignment
    _auditIprStatus(application, application.status, 'under_drd_review', userId, req, `Assigned to reviewer: ${reviewerId}`);

    res.json({
      success: true,
      message: 'Reviewer assigned successfully',
    });
  } catch (error) {
    console.error('Assign DRD reviewer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign reviewer',
    });
  }
};

// Submit DRD review (recommend/changes_required/reject)
const submitDrdReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, edits, decision } = req.body;
    const userId = req.user.id;

    // Validate decision
    if (!['approved', 'changes_required', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be approved, changes_required, or rejected',
      });
    }

    // "Approved" moves the IPR past the DRD head, so it needs approve rights — a reviewer
    // (ipr_review only) recommends; someone holding ipr_approve approves.
    if (decision === 'approved' && !['admin', 'superadmin'].includes(req.user?.role)) {
      const holdsApprove = (req.user?.centralDeptPermissions || []).some(
        (d) => d.permissions && (d.permissions.ipr_approve === true || d.permissions.drd_ipr_approve === true)
      );
      if (!holdsApprove) {
        return res.status(403).json({
          success: false,
          code: 'APPROVE_PERMISSION_REQUIRED',
          message: 'Approving an IPR needs the IPR approve permission. Recommend it to the DRD head instead.',
        });
      }
    }

    // Check if application exists
    const application = await prisma.iprApplication.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    const allowed = IPR_TRANSITIONS.review;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'submit a DRD review for', application.status, allowed);
    }

    // Determine new status
    let newStatus;
    if (decision === 'approved') {
      newStatus = 'drd_head_approved';  // Direct approval - ready for govt filing
    } else if (decision === 'changes_required') {
      newStatus = 'changes_required';
    } else {
      newStatus = 'drd_rejected';
    }

    // Review row, status change and history are one unit: a failed status update must not
    // leave an orphan review behind. IprApplication has no approval timestamp column; the
    // approval time is the review's reviewedAt and the status-history row.
    let review;
    try {
      review = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, {
          status: newStatus,
          ...(newStatus === 'drd_rejected' ? { completedAt: new Date() } : {}),
        }, 'submit a DRD review for');

        const created = await tx.iprReview.create({
          data: {
            iprApplicationId: id,
            reviewerId: userId,
            reviewerRole: 'drd_member',
            comments,
            edits: edits || {},
            decision,
            reviewedAt: new Date(),
          },
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: newStatus,
            changedById: userId,
            comments: `DRD review: ${decision}`,
          },
        });

        return created;
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Notify contributors about status change
    const statusMessages = {
      'drd_head_approved': {
        title: 'IPR Application Approved!',
        message: `Great news! The IPR application "${application.title}" has been approved by DRD and is ready for government filing.`
      },
      'changes_required': {
        title: 'Changes Required for IPR Application',
        message: `The reviewer has requested changes for IPR application "${application.title}". Please check the application for details.`
      },
      'drd_rejected': {
        title: 'IPR Application Rejected',
        message: `The IPR application "${application.title}" has been rejected by DRD.`
      }
    };

    if (statusMessages[newStatus]) {
      await notifyContributors(
        id,
        'ipr_status_change',
        statusMessages[newStatus].title,
        statusMessages[newStatus].message,
        { newStatus, decision, reviewerComments: comments }
      );
    }

    // Audit: DRD review decision
    _auditIprStatus(application, application.status, newStatus, userId, req, comments || `DRD review: ${decision}`);

    res.json({
      success: true,
      message: `DRD review submitted (${decision})`,
      data: review,
    });
  } catch (error) {
    console.error('Submit DRD review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review',
    });
  }
};

// Accept edits and resubmit application
const acceptEditsAndResubmit = async (req, res) => {
  try {
    const { id } = req.params;
    const { updatedData } = req.body;
    const userId = req.user.id;

    // Check if application exists
    const application = await prisma.iprApplication.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    if (application.status !== 'changes_required') {
      return res.status(400).json({
        success: false,
        message: `Cannot resubmit an application in status: ${application.status}`,
      });
    }

    // Mass-assignment guard: only descriptive IPR fields may be changed here
    // (never status, incentive, applicant or mentor fields). Unknown keys are dropped.
    const allowedData = pickAllowed(updatedData, IPR_EDITABLE_FIELDS);

    // Update application data and resubmit
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        ...allowedData,
        status: 'resubmitted',
        submittedAt: new Date(),
      },
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'resubmitted',
        changedById: userId,
        comments: 'Accepted edits and resubmitted',
      },
    });

    // Audit: edits accepted and resubmitted
    _auditIprStatus(application, application.status, 'resubmitted', userId, req, 'Accepted edits and resubmitted');

    res.json({
      success: true,
      message: 'Edits accepted and application resubmitted',
      data: updated,
    });
  } catch (error) {
    console.error('Accept edits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept edits',
    });
  }
};

// Get DRD review statistics
const getDrdReviewStatistics = async (req, res) => {
  try {
    const { reviewerId } = req.query;

    // Counts follow the same school scope as the IPR queue (empty assignment = all schools)
    const schoolWhere = reviewScope.scopeWhere(await reviewScope.getSchoolScope(req.user, 'ipr')) || {};
    const where = {
      ...(reviewerId ? { reviewerId } : {}),
      ...(Object.keys(schoolWhere).length ? { iprApplication: schoolWhere } : {}),
    };

    const [
      totalReviews,
      approvedReviews,
      rejectedReviews,
      changesRequiredReviews,
      pendingApplications,
      pendingHeadApproval,
      activeApplications,
      completedApplications,
    ] = await Promise.all([
      prisma.iprReview.count({
        where: {
          ...where,
          reviewerRole: 'drd_member',
        },
      }),
      prisma.iprReview.count({
        where: {
          ...where,
          reviewerRole: 'drd_member',
          decision: 'approved',
        },
      }),
      prisma.iprReview.count({
        where: {
          ...where,
          reviewerRole: 'drd_member',
          decision: 'rejected',
        },
      }),
      prisma.iprReview.count({
        where: {
          ...where,
          reviewerRole: 'drd_member',
          decision: 'changes_required',
        },
      }),
      // Applications awaiting DRD member review
      prisma.iprApplication.count({
        where: {
          ...schoolWhere,
          status: { in: ['submitted', 'under_drd_review', 'resubmitted'] },
        },
      }),
      // Applications awaiting DRD Head approval (recommended by member)
      prisma.iprApplication.count({
        where: {
          ...schoolWhere,
          status: { in: ['recommended_to_head'] },
        },
      }),
      // All active applications in the pipeline (not completed or rejected)
      prisma.iprApplication.count({
        where: {
          ...schoolWhere,
          status: { 
            notIn: ['draft', 'completed', 'drd_rejected', 'cancelled'] 
          },
        },
      }),
      // Completed/fully approved applications
      prisma.iprApplication.count({
        where: {
          ...schoolWhere,
          status: { in: ['completed', 'drd_head_approved', 'submitted_to_govt', 'govt_application_filed'] },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalReviews,
        approved: approvedReviews,
        rejected: rejectedReviews,
        changesRequired: changesRequiredReviews,
        pendingApplications,
        pendingHeadApproval,
        activeApplications,
        completedApplications,
      },
    });
  } catch (error) {
    console.error('Get DRD review statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
    });
  }
};

// Calculate incentive points
const calculateIncentivePoints = (iprType, projectType) => {
  const pointMatrix = {
    patent: {
      phd: { points: 100, amount: 50000 },
      pg_project: { points: 75, amount: 37500 },
      ug_project: { points: 50, amount: 25000 },
      faculty_research: { points: 100, amount: 50000 },
      industry_collaboration: { points: 80, amount: 40000 },
      any_other: { points: 60, amount: 30000 }
    },
    copyright: {
      phd: { points: 40, amount: 20000 },
      pg_project: { points: 30, amount: 15000 },
      ug_project: { points: 20, amount: 10000 },
      faculty_research: { points: 40, amount: 20000 },
      industry_collaboration: { points: 35, amount: 17500 },
      any_other: { points: 25, amount: 12500 }
    },
    trademark: {
      phd: { points: 30, amount: 15000 },
      pg_project: { points: 25, amount: 12500 },
      ug_project: { points: 20, amount: 10000 },
      faculty_research: { points: 30, amount: 15000 },
      industry_collaboration: { points: 25, amount: 12500 },
      any_other: { points: 20, amount: 10000 }
    }
  };

  return pointMatrix[iprType]?.[projectType] || { points: 0, amount: 0 };
};

// DRD Head Final Approval - sends to Finance directly (no Dean)
const finalApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    // Check if application exists
    const application = await prisma.iprApplication.findUnique({
      where: { id },
      include: {
        applicantUser: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    const allowed = IPR_TRANSITIONS.finalApproval;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'approve', application.status, allowed);
    }

    // Status change, review and history in one transaction with an atomic status guard
    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, {
          status: 'submitted_to_govt',
          currentReviewerId: userId, // Assign to DRD Head for govt filing updates
        }, 'approve');

        await tx.iprReview.create({
          data: {
            iprApplicationId: id,
            reviewerId: userId,
            reviewerRole: 'drd_head',
            comments: comments || 'Application approved by DRD Head',
            decision: 'approved',
            reviewedAt: new Date()
          }
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'submitted_to_govt',
            changedById: userId,
            comments: comments || 'DRD Head approved - submitted to government for filing'
          }
        });

        return tx.iprApplication.findUnique({ where: { id } });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Notify applicant
    if (application.applicantUserId) {
      await safeNotify({
        userId: application.applicantUserId,
        type: 'ipr_approved',
        title: 'IPR Application Approved - Submitted to Government!',
        message: `Your IPR application "${application.title}" has been approved by DRD Head and submitted to government for filing.`,
        referenceType: 'ipr_application',
        referenceId: id,
        metadata: { newStatus: 'submitted_to_govt' }
      });
    }

    // Notify contributors
    await notifyContributors(
      id,
      'ipr_approved',
      'IPR Application Approved - Submitted to Government!',
      `The IPR application "${application.title}" has been approved by DRD Head and submitted to government.`,
      { newStatus: 'submitted_to_govt' }
    );

    // Audit: DRD Head final approval
    _auditIprStatus(application, application.status, 'submitted_to_govt', userId, req, comments || 'DRD Head approved - submitted to government');

    res.json({
      success: true,
      message: 'IPR application approved by DRD Head - submitted to government for filing',
      data: {
        application: updated,
        status: 'submitted_to_govt'
      }
    });

  } catch (error) {
    console.error('Final approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve application',
    });
  }
};

// DRD Final Rejection
const finalRejection = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required for rejection'
      });
    }

    // Check if application exists
    const application = await prisma.iprApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    const allowed = IPR_TRANSITIONS.finalRejection;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'reject', application.status, allowed);
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, {
          status: 'drd_rejected',
          completedAt: new Date()
        }, 'reject');

        await tx.iprReview.create({
          data: {
            iprApplicationId: id,
            reviewerId: userId,
            reviewerRole: 'drd_approver',
            comments,
            decision: 'rejected',
            reviewedAt: new Date()
          }
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'drd_rejected',
            changedById: userId,
            comments: `Final rejection by DRD: ${comments}`
          }
        });

        return tx.iprApplication.findUnique({ where: { id } });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Audit: DRD final rejection
    _auditIprStatus(application, application.status, 'drd_rejected', userId, req, comments);

    res.json({
      success: true,
      message: 'IPR application rejected by DRD',
      data: updated
    });

  } catch (error) {
    console.error('Final rejection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject application',
    });
  }
};

// Request Changes from Applicant
const requestChanges = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, edits } = req.body;
    const userId = req.user.id;

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required when requesting changes'
      });
    }

    // Check if application exists
    const application = await prisma.iprApplication.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        applicantUserId: true,
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    const allowedFrom = IPR_TRANSITIONS.requestChanges;
    if (!allowedFrom.includes(application.status)) {
      return sendInvalidTransition(res, 'request changes on', application.status, allowedFrom);
    }

    // Get reviewer info
    const reviewer = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        uid: true,
        employeeDetails: {
          select: { displayName: true, firstName: true }
        }
      }
    });
    const reviewerName = reviewer?.employeeDetails?.displayName ||
      reviewer?.employeeDetails?.firstName ||
      reviewer?.uid || 'DRD Reviewer';

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowedFrom, {
          status: 'changes_required',
          currentReviewerId: userId
        }, 'request changes on');

        await tx.iprReview.create({
          data: {
            iprApplicationId: id,
            reviewerId: userId,
            reviewerRole: 'drd_member',
            comments,
            edits: edits || {},
            decision: 'changes_required',
            reviewedAt: new Date()
          }
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'changes_required',
            changedById: userId,
            comments: `Changes requested: ${comments}`
          }
        });

        return tx.iprApplication.findUnique({ where: { id } });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Send notification to applicant
    if (application.applicantUserId) {
      await safeNotify({
        userId: application.applicantUserId,
        type: 'ipr_changes_requested',
        title: 'Changes Requested for Your IPR Application',
        message: `${reviewerName} has requested changes to your IPR application "${application.title}". Please review the comments and make the necessary updates.`,
        referenceType: 'ipr_application',
        referenceId: id,
        metadata: {
          reviewerName,
          comments,
          actionUrl: `/ipr/my-applications/${id}`,
          actionLabel: 'View & Update'
        }
      });
    }

    // Notify all contributors
    await notifyContributors(
      id,
      'ipr_changes_requested',
      'Changes Requested for IPR Application',
      `Changes have been requested for IPR "${application.title}". Comments: ${comments.substring(0, 100)}${comments.length > 100 ? '...' : ''}`,
      { actionUrl: `/ipr/my-applications/${id}` }
    );

    // Audit: changes requested
    _auditIprStatus(application, application.status, 'changes_required', userId, req, comments);

    res.json({
      success: true,
      message: 'Changes requested successfully',
      data: updated
    });
  } catch (error) {
    console.error('Request changes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request changes',
    });
  }
};

// System Administrator Override (Emergency use only)
const systemOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments, newStatus } = req.body;
    const userId = req.user.id;

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required for system override'
      });
    }

    // Check if application exists
    const application = await prisma.iprApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Determine override status (default to completed if not specified)
    const overrideStatus = newStatus || 'completed';

    // Update application with override
    const updatedApplication = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: overrideStatus,
        completedAt: overrideStatus === 'completed' ? new Date() : null,
        currentReviewerId: userId
      },
      include: {
        applicantUser: {
          include: {
            employeeDetails: true,
          }
        },
        applicantDetails: true,
        sdgs: true,
        school: true,
        department: true,
        reviews: {
          include: {
            reviewer: {
              include: {
                employeeDetails: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Create system override review record
    await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'system_admin',
        comments: `SYSTEM OVERRIDE: ${comments}`,
        decision: overrideStatus.includes('rejected') ? 'rejected' : 'approved',
        reviewedAt: new Date()
      }
    });

    // Create status history with override flag
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: overrideStatus,
        changedById: userId,
        comments: `SYSTEM OVERRIDE BY ADMIN: ${comments}`,
        metadata: {
          systemOverride: true,
          originalStatus: application.status
        }
      }
    });

    // Audit: system override
    _auditIprStatus(application, application.status, overrideStatus, userId, req, comments || `System override to ${overrideStatus}`);

    res.json({
      success: true,
      message: `System override applied - status changed to ${overrideStatus}`,
      data: updatedApplication
    });

  } catch (error) {
    console.error('System override error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply system override',
    });
  }
};

// Reviewer recommends application to DRD Head
const recommendToHead = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    const application = await prisma.iprApplication.findUnique({
      where: { id },
      include: { applicantUser: true }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    const allowed = IPR_TRANSITIONS.recommendToHead;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'recommend', application.status, allowed);
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, {
          status: 'recommended_to_head',
          currentReviewerId: userId
        }, 'recommend');

        await tx.iprReview.create({
          data: {
            iprApplicationId: id,
            reviewerId: userId,
            reviewerRole: 'drd_member',
            comments: comments || 'Recommended to DRD Head for approval',
            decision: 'recommended',
            reviewedAt: new Date()
          }
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'recommended_to_head',
            changedById: userId,
            comments: comments || 'Application recommended to DRD Head'
          }
        });

        return tx.iprApplication.findUnique({
          where: { id },
          include: { applicantDetails: true, contributors: true, sdgs: true }
        });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Notify contributors
    await notifyContributors(
      id,
      'ipr_status_change',
      'IPR Application Recommended',
      `The IPR application "${application.title}" has been recommended to DRD Head for approval.`,
      { newStatus: 'recommended_to_head' }
    );

    // Audit: recommend to DRD Head
    _auditIprStatus(application, application.status, 'recommended_to_head', userId, req, comments || 'Recommended to DRD Head');

    res.json({
      success: true,
      message: 'Application recommended to DRD Head',
      data: updated
    });
  } catch (error) {
    console.error('Recommend to head error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recommend application',
    });
  }
};

// DRD Head approves and marks as submitted to government
const headApproveAndSubmitToGovt = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    const application = await prisma.iprApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    const allowed = IPR_TRANSITIONS.headApprove;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'approve and submit to Government', application.status, allowed);
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, {
          status: 'submitted_to_govt',
          currentReviewerId: userId
        }, 'approve and submit to Government');

        await tx.iprReview.create({
          data: {
            iprApplicationId: id,
            reviewerId: userId,
            reviewerRole: 'drd_head',
            comments: comments || 'Approved and submitted to Government',
            decision: 'approved',
            reviewedAt: new Date()
          }
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'submitted_to_govt',
            changedById: userId,
            comments: 'DRD Head approved - Submitted to Government'
          }
        });

        return tx.iprApplication.findUnique({
          where: { id },
          include: { applicantDetails: true, contributors: true, sdgs: true }
        });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Notify contributors
    await notifyContributors(
      id,
      'ipr_status_change',
      'IPR Approved - Submitted to Government',
      `Great news! The IPR application "${application.title}" has been approved by DRD Head and submitted to Government.`,
      { newStatus: 'submitted_to_govt' }
    );

    // Audit: Head approve & submit to govt
    _auditIprStatus(application, application.status, 'submitted_to_govt', userId, req, 'DRD Head approved - Submitted to Government');

    res.json({
      success: true,
      message: 'Application approved and submitted to Government',
      data: updated
    });
  } catch (error) {
    console.error('Head approve error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve application',
    });
  }
};

// Add Government Application ID
const addGovtApplicationId = async (req, res) => {
  try {
    const { id } = req.params;
    const { govtApplicationId, govtFilingDate, comments } = req.body;
    const userId = req.user.id;

    if (!govtApplicationId) {
      return res.status(400).json({
        success: false,
        message: 'Government Application ID is required'
      });
    }

    const application = await prisma.iprApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Only after DRD Head approval (or to correct the ID of an already filed application)
    const allowed = IPR_TRANSITIONS.govtApplication;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'add a Government Application ID to', application.status, allowed);
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, {
          govtApplicationId,
          govtFilingDate: govtFilingDate ? new Date(govtFilingDate) : new Date(),
          status: 'govt_application_filed'
        }, 'add a Government Application ID to');

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'govt_application_filed',
            changedById: userId,
            comments: `Government Application ID added: ${govtApplicationId}`,
            metadata: { govtApplicationId, govtFilingDate }
          }
        });

        return tx.iprApplication.findUnique({
          where: { id },
          include: {
            applicantUser: {
              select: {
                uid: true,
                email: true,
                employeeDetails: { select: { firstName: true, lastName: true } }
              }
            },
            applicantDetails: true,
            contributors: true,
            sdgs: true
          }
        });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Notify applicant
    if (application.applicantUserId) {
      await safeNotify({
        userId: application.applicantUserId,
        type: 'ipr_govt_filed',
        title: 'Government Application Filed',
        message: `Your IPR application "${application.title}" has been filed with the Government. Application ID: ${govtApplicationId}`,
        referenceType: 'ipr_application',
        referenceId: id,
        metadata: { govtApplicationId }
      });
    }

    // Notify contributors
    await notifyContributors(
      id,
      'ipr_govt_filed',
      'Government Application Filed',
      `The IPR application "${application.title}" has been filed with the Government. Application ID: ${govtApplicationId}`,
      { govtApplicationId, newStatus: 'govt_application_filed' }
    );

    // Audit: govt application filed
    _auditIprStatus(application, application.status, 'govt_application_filed', userId, req, `Government Application ID: ${govtApplicationId}`);

    res.json({
      success: true,
      message: 'Government Application ID added successfully',
      data: updated
    });
  } catch (error) {
    console.error('Add govt application ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add Government Application ID',
    });
  }
};

/**
 * Split the IPR incentive equally among internal inventors and put each share into the
 * payout ledger. Runs inside the publication transaction; notifications are returned for
 * the caller to send after commit.
 */
const creditIncentivesToInventors = async (tx, application, userId, approvedAt = new Date()) => {
  // Policy in force at publication (same date-window rule as ipr.repository.findActivePolicy);
  // the built-in defaults apply only when none is configured, and that is recorded.
  const { policy, usedDefaultPolicy } = await resolveIprPolicy(tx, application.iprType, approvedAt);
  const totalIncentive = assertWithinCap(toNumber(policy.baseIncentiveAmount), 'this IPR');
  const totalPoints = toNumber(policy.basePoints);

  const inventors = await resolveIprInventors(tx, application);
  const inventorCount = inventors.length || 1;
  const perInventorIncentive = Math.floor(totalIncentive / inventorCount);
  const perInventorPoints = Math.floor(totalPoints / inventorCount);

  const ledger = await createIprPayoutLines(tx, application, {
    inventors, perInventorIncentive, perInventorPoints, approvedAt, actorId: userId,
  });

  // One combined "published + incentive approved" notification per inventor (the applicant
  // is included as primary inventor); addPublicationId sends nothing else to these users.
  // Students are paid money only, never research points.
  const notifications = inventors.filter((inv) => inv.userId).map((inv) => ({
    userId: inv.userId,
    type: 'ipr_published',
    title: 'IPR Published & Incentive Approved [PAYMENT]',
    message: `Congratulations! Your IPR "${application.title}" has been published (Publication ID: ${application.publicationId}). Your share of ₹${perInventorIncentive.toLocaleString()}${inv.isStudent ? '' : ` and ${perInventorPoints} research points`} has been approved; finance will process the payment.`,
    referenceType: 'ipr_application',
    referenceId: application.id,
    metadata: {
      incentiveAmount: perInventorIncentive,
      pointsAwarded: inv.isStudent ? 0 : perInventorPoints,
      publicationId: application.publicationId,
      totalInventors: inventorCount,
    },
  }));

  return { totalIncentive, totalPoints, perInventorIncentive, perInventorPoints, inventorCount, ledger, notifications, usedDefaultPolicy };
};

// Add Publication ID (after patent/copyright is granted) - Auto credits incentives
// Also handles govt_rejected status to record rejection reference
const addPublicationId = async (req, res) => {
  try {
    const { id } = req.params;
    const { publicationId, publicationDate, comments } = req.body;
    const userId = req.user.id;

    if (!publicationId) {
      return res.status(400).json({
        success: false,
        message: 'Publication ID or Rejection Reference is required'
      });
    }

    const application = await prisma.iprApplication.findUnique({
      where: { id },
      include: {
        contributors: true
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Check if this is a rejection case
    const isRejection = application.status === 'govt_rejected';

    // For rejections, just update the application with rejection reference - no incentives
    if (isRejection) {
      const updated = await prisma.iprApplication.update({
        where: { id },
        data: {
          publicationId, // Store rejection reference in publicationId field
          publicationDate: publicationDate ? new Date(publicationDate) : new Date(),
          // Status remains govt_rejected - no further status change
        },
        include: {
          applicantUser: {
            select: {
              uid: true,
              email: true,
              employeeDetails: { select: { firstName: true, lastName: true } }
            }
          },
          applicantDetails: true,
          contributors: true,
          sdgs: true
        }
      });

      // Create status history
      await prisma.iprStatusHistory.create({
        data: {
          iprApplicationId: id,
          fromStatus: application.status,
          toStatus: 'govt_rejected',
          changedById: userId,
          comments: `Rejection reference added: ${publicationId}. ${comments || 'Government rejected the application.'}`,
          metadata: { 
            rejectionReference: publicationId, 
            rejectionDate: publicationDate
          }
        }
      });

      // Notify applicant about rejection
      if (application.applicantUserId) {
        await prisma.notification.create({
          data: {
            userId: application.applicantUserId,
            type: 'ipr_govt_rejected',
            title: 'IPR Application Rejected by Government',
            message: `Your IPR "${application.title}" has been rejected by the government. Rejection Reference: ${publicationId}. ${comments || 'Please contact DRD for more details.'}`,
            referenceType: 'ipr_application',
            referenceId: id,
            metadata: { 
              rejectionReference: publicationId
            }
          }
        });
      }

      // Audit: rejection reference added
      _auditIprStatus(application, application.status, 'govt_rejected', userId, req, `Rejection reference: ${publicationId}`);

      return res.json({
        success: true,
        message: 'Rejection reference added successfully',
        data: updated
      });
    }

    // Original publication flow (for successful applications).
    // Incentives are credited exactly once: a repeat call must not pay inventors again.
    if (application.creditedAt || IPR_CREDITED_STATUSES.includes(application.status)) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_CREDITED',
        message: 'This IPR is already published and its incentives have already been sent to finance',
      });
    }

    // Publication (and the incentive payment) only after the Government filing is recorded
    if (!IPR_TRANSITIONS.publication.includes(application.status)) {
      return sendInvalidTransition(res, 'add a Publication ID to', application.status, IPR_TRANSITIONS.publication);
    }

    const now = new Date();
    let updated;
    let incentiveResult;
    try {
      ({ updated, incentiveResult } = await prisma.$transaction(async (tx) => {
        // Claim the crediting atomically so concurrent calls cannot both credit.
        const claimed = await tx.iprApplication.updateMany({
          where: { id, creditedAt: null, status: { in: IPR_TRANSITIONS.publication } },
          data: {
            publicationId,
            publicationDate: publicationDate ? new Date(publicationDate) : now,
            status: 'published',
            completedAt: now,
            creditedAt: now,
          },
        });
        if (claimed.count !== 1) {
          const err = new Error('This IPR is already published and its incentives have already been sent to finance');
          err.statusCode = 409;
          err.code = 'ALREADY_CREDITED';
          throw err;
        }

        const result = await creditIncentivesToInventors(tx, { ...application, publicationId }, userId, now);

        // Store per-inventor share (what each inventor receives)
        const row = await tx.iprApplication.update({
          where: { id },
          data: { incentiveAmount: result.perInventorIncentive, pointsAwarded: result.perInventorPoints },
          include: {
            applicantUser: {
              select: {
                uid: true,
                email: true,
                employeeDetails: { select: { firstName: true, lastName: true } }
              }
            },
            applicantDetails: true,
            contributors: true,
            sdgs: true
          }
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'published',
            changedById: userId,
            comments: `Publication ID added: ${publicationId}. Total Incentive: ₹${result.totalIncentive} and ${result.totalPoints} points. Each inventor receives: ₹${result.perInventorIncentive} and ${result.perInventorPoints} points (split among ${result.inventorCount} inventor(s)); sent to finance for payment${result.usedDefaultPolicy ? `. Incentive from the built-in DEFAULT ${String(application.iprType || 'patent').toLowerCase()} policy (no IPR incentive policy configured)` : ''}`,
            metadata: {
              publicationId,
              publicationDate,
              totalIncentive: result.totalIncentive,
              totalPoints: result.totalPoints,
              perInventorIncentive: result.perInventorIncentive,
              perInventorPoints: result.perInventorPoints,
              inventorCount: result.inventorCount,
              payoutLinesCreated: result.ledger.created,
            }
          }
        });

        return { updated: row, incentiveResult: result };
      }));
    } catch (err) {
      if (err.statusCode === 409 || err.statusCode === 422) {
        return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message });
      }
      throw err;
    }

    const { totalIncentive, totalPoints, perInventorIncentive, perInventorPoints, inventorCount } = incentiveResult;

    // Inventors (incl. the applicant) get exactly one combined published + payment notification
    const notifiedUserIds = incentiveResult.notifications.map((n) => n.userId);
    if (incentiveResult.notifications.length) {
      await prisma.notification.createMany({ data: incentiveResult.notifications }).catch((e) => {
        console.error('IPR incentive notification error:', e);
      });
    }

    // Other internal contributors (non-inventor roles) only hear that it was published
    await notifyContributors(
      id,
      'ipr_published',
      'IPR Published',
      `The IPR "${application.title}" has been published. Publication ID: ${publicationId}.`,
      { publicationId, newStatus: 'published' },
      { excludeUserIds: notifiedUserIds }
    );

    // Audit: publication ID added, IPR published
    _auditIprStatus(application, application.status, 'published', userId, req, `Publication ID: ${publicationId}`);

    res.json({
      success: true,
      message: `Publication ID added successfully! Total: ₹${totalIncentive} and ${totalPoints} points. Each inventor receives: ₹${perInventorIncentive} and ${perInventorPoints} points (split among ${inventorCount} inventor(s))`,
      data: {
        ...updated,
        incentiveDetails: {
          totalIncentive,
          totalPoints,
          perInventorIncentive,
          perInventorPoints,
          inventorCount
        }
      }
    });
  } catch (error) {
    console.error('Add publication ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add Publication ID',
    });
  }
};

/**
 * Mark IPR application as Government Rejected
 * Used when government rejects the application after filing
 */
const markGovtRejected = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason/comments are required'
      });
    }

    const application = await prisma.iprApplication.findUnique({
      where: { id },
      include: {
        applicantUser: {
          select: {
            uid: true,
            email: true,
            employeeDetails: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    const allowed = IPR_TRANSITIONS.govtRejected;
    if (!allowed.includes(application.status)) {
      return sendInvalidTransition(res, 'mark as Government rejected', application.status, allowed);
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        await claimIprTransition(tx, id, allowed, { status: 'govt_rejected' }, 'mark as Government rejected');

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId: id,
            fromStatus: application.status,
            toStatus: 'govt_rejected',
            changedById: userId,
            comments: `Government rejected the application. Reason: ${comments}`,
            metadata: {
              rejectionReason: comments
            }
          }
        });

        return tx.iprApplication.findUnique({ where: { id } });
      });
    } catch (err) {
      if (respondIfTransitionError(res, err)) return;
      throw err;
    }

    // Notify applicant about rejection
    if (application.applicantUserId) {
      await safeNotify({
        userId: application.applicantUserId,
        type: 'ipr_govt_rejected',
        title: 'IPR Application Rejected by Government',
        message: `Your IPR "${application.title}" has been rejected by the government. Reason: ${comments}. Please contact DRD for more details.`,
        referenceType: 'ipr_application',
        referenceId: id,
        metadata: {
          rejectionReason: comments
        }
      });
    }

    // Audit: govt rejection
    _auditIprStatus(application, application.status, 'govt_rejected', userId, req, comments || 'Government rejected');

    res.json({
      success: true,
      message: 'Application marked as Government Rejected',
      data: updated
    });
  } catch (error) {
    console.error('Mark govt rejected error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark application as rejected',
    });
  }
};

/**
 * Add a status update for an IPR application (DRD communication to applicant/inventors)
 * Used for complete filing to communicate hearing schedules, document requests, milestones, etc.
 */
const addStatusUpdate = async (req, res) => {
  try {
    const { id } = req.params; // IPR application ID
    const { updateMessage, updateType, priority, notifyApplicant, notifyInventors } = req.body;
    const userId = req.user.id;

    // Validate the IPR application exists
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id },
      include: {
        applicantUser: {
          select: {
            id: true,
            uid: true,
          }
        },
        applicantDetails: {
          select: {
            inventorUid: true,
          }
        },
        contributors: {
          where: { userId: { not: null } },
          select: { userId: true, uid: true, name: true }
        }
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    // Create the status update
    const statusUpdate = await prisma.iprStatusUpdate.create({
      data: {
        iprApplication: { connect: { id } },
        createdBy: { connect: { id: userId } },
        updateMessage,
        updateType: updateType || 'general',
        priority: priority || 'medium',
        isVisibleToApplicant: notifyApplicant !== false,
        isVisibleToInventors: notifyInventors !== false,
      },
      include: {
        createdBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      }
    });

    // Send notifications based on settings
    const notificationTitle = updateType === 'hearing' 
      ? 'IPR Hearing Scheduled'
      : updateType === 'document_request'
      ? 'Document Required for IPR'
      : updateType === 'milestone'
      ? 'IPR Milestone Update'
      : 'IPR Application Update';

    if (notifyApplicant !== false) {
      // Notify the applicant
      await prisma.notification.create({
        data: {
          userId: iprApplication.applicantUser.id,
          type: 'ipr_status_update',
          title: notificationTitle,
          message: updateMessage,
          referenceType: 'ipr_application',
          referenceId: id,
          metadata: {
            updateType,
            priority,
            statusUpdateId: statusUpdate.id,
          }
        }
      });
    }

    if (notifyInventors !== false && iprApplication.contributors?.length > 0) {
      // Batch notify all inventors/contributors (single DB round-trip)
      const contributorNotifs = iprApplication.contributors
        .filter(c => c.userId && c.userId !== iprApplication.applicantUser.id)
        .map(c => ({
          userId: c.userId,
          type: 'ipr_status_update',
          title: notificationTitle,
          message: updateMessage,
          referenceType: 'ipr_application',
          referenceId: id,
          metadata: { updateType, priority, statusUpdateId: statusUpdate.id },
        }));
      if (contributorNotifs.length) {
        await prisma.notification.createMany({ data: contributorNotifs });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Status update added and notifications sent',
      data: statusUpdate,
    });
  } catch (error) {
    console.error('Add status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add status update',
    });
  }
};

/**
 * Get all status updates for an IPR application
 * Accessible by DRD, applicant, and inventors
 */
const getStatusUpdates = async (req, res) => {
  try {
    const { id } = req.params; // IPR application ID
    const userId = req.user.id;

    // Applicant, inventors/contributors, mentor, reviewers and IPR staff only; others get 404
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id },
      include: IPR_ACCESS_INCLUDE,
    });
    if (!canViewIpr(req.user, iprApplication)) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    // Get status updates
    const statusUpdates = await prisma.iprStatusUpdate.findMany({
      where: { iprApplicationId: id },
      include: {
        createdBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: statusUpdates,
    });
  } catch (error) {
    console.error('Get status updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get status updates',
    });
  }
};

/**
 * Delete a status update (DRD only, for corrections)
 */
const deleteStatusUpdate = async (req, res) => {
  try {
    const { updateId } = req.params;
    const userId = req.user.id;

    // Verify the update exists and get the creator
    const statusUpdate = await prisma.iprStatusUpdate.findUnique({
      where: { id: updateId },
      select: {
        id: true,
        createdById: true,
        createdAt: true,
      }
    });

    if (!statusUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Status update not found',
      });
    }

    // Only allow deletion if:
    // 1. User created the update
    // 2. Or user has DRD admin/head permissions
    if (statusUpdate.createdById !== userId) {
      // Check DRD head permissions from req.user (includes role-based)
      let mergedPermissions = {};
      
      if (req.user?.centralDeptPermissions && Array.isArray(req.user.centralDeptPermissions)) {
        req.user.centralDeptPermissions.forEach(deptPerm => {
          if (deptPerm.permissions) {
            Object.assign(mergedPermissions, deptPerm.permissions);
          }
        });
      }

      const isDrdHead = mergedPermissions.ipr_approve === true || mergedPermissions.drd_ipr_approve === true;

      if (!isDrdHead) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own status updates',
        });
      }
    }

    // Delete the update
    await prisma.iprStatusUpdate.delete({
      where: { id: updateId }
    });

    res.json({
      success: true,
      message: 'Status update deleted successfully',
    });
  } catch (error) {
    console.error('Delete status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete status update',
    });
  }
};

module.exports = {
  getPendingDrdReviews,
  assignDrdReviewer,
  submitDrdReview,
  acceptEditsAndResubmit,
  getDrdReviewStatistics,
  finalApproval,
  finalRejection,
  requestChanges,
  systemOverride,
  recommendToHead,
  headApproveAndSubmitToGovt,
  addGovtApplicationId,
  addPublicationId,
  markGovtRejected,
  addStatusUpdate,
  getStatusUpdates,
  deleteStatusUpdate,
};
