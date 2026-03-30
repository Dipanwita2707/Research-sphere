/**
 * Finance Service
 * Contains all finance business logic extracted from finance.controller.js
 * Zero business logic changes — only moved from controller to service.
 */

const prisma = require('../../../shared/config/database');
const log = require('../../../shared/utils/logger');

/**
 * Get all IPR applications pending for Finance review
 */
const getPendingFinanceReviews = async ({ page = 1, limit = 10, iprType, schoolId }) => {
  const where = {
    status: { in: ['under_finance_review'] },
  };
  if (iprType) where.iprType = iprType;
  if (schoolId) where.schoolId = schoolId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [applications, total] = await Promise.all([
    prisma.iprApplication.findMany({
      where,
      skip,
      take,
      include: {
        applicantUser: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                empId: true,
              },
            },
          },
        },
        applicantDetails: true,
        sdgs: true,
        school: {
          select: { facultyName: true, facultyCode: true },
        },
        department: {
          select: { departmentName: true, departmentCode: true },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                uid: true,
                employeeDetails: {
                  select: { displayName: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        financeRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.iprApplication.count({ where }),
  ]);

  return {
    data: applications,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

/**
 * Process finance audit and incentive
 */
const processFinanceIncentive = async (id, body, userId) => {
  const {
    auditStatus,
    auditComments,
    incentiveAmount,
    pointsAwarded,
    paymentReference,
    creditedToAccount,
  } = body;

  if (!['approved', 'rejected'].includes(auditStatus)) {
    return { error: 'Invalid audit status. Must be approved or rejected', status: 400 };
  }

  const application = await prisma.iprApplication.findUnique({ where: { id } });
  if (!application) {
    return { error: 'IPR application not found', status: 404 };
  }

  const financeRecord = await prisma.iprFinance.create({
    data: {
      iprApplicationId: id,
      financeReviewerId: userId,
      auditStatus,
      auditComments,
      incentiveAmount: auditStatus === 'approved' ? incentiveAmount : 0,
      pointsAwarded: auditStatus === 'approved' ? pointsAwarded : null,
      paymentReference: auditStatus === 'approved' ? paymentReference : null,
      creditedToAccount: auditStatus === 'approved' ? creditedToAccount : null,
      approvedAt: auditStatus === 'approved' ? new Date() : null,
      creditedAt: auditStatus === 'approved' ? new Date() : null,
    },
  });

  const newStatus = auditStatus === 'approved' ? 'completed' : 'finance_rejected';

  await prisma.iprApplication.update({
    where: { id },
    data: {
      status: newStatus,
      incentiveAmount: auditStatus === 'approved' ? incentiveAmount : null,
      pointsAwarded: auditStatus === 'approved' ? pointsAwarded : null,
      creditedAt: auditStatus === 'approved' ? new Date() : null,
      completedAt: auditStatus === 'approved' ? new Date() : null,
    },
  });

  await prisma.iprReview.create({
    data: {
      iprApplicationId: id,
      reviewerId: userId,
      reviewerRole: 'finance',
      comments: auditComments,
      decision: auditStatus,
      reviewedAt: new Date(),
    },
  });

  await prisma.iprStatusHistory.create({
    data: {
      iprApplicationId: id,
      fromStatus: application.status,
      toStatus: newStatus,
      changedById: userId,
      comments: `Finance audit: ${auditStatus}`,
      metadata: { incentiveAmount, pointsAwarded, paymentReference },
    },
  });

  return { data: financeRecord, message: `Finance processing completed (${auditStatus})` };
};

/**
 * Get finance statistics
 */
const getFinanceStatistics = async (reviewerId) => {
  const where = reviewerId ? { financeReviewerId: reviewerId } : {};

  const [
    totalReviews,
    approvedReviews,
    rejectedReviews,
    totalIncentivesAmount,
    pendingApplications,
    completedApplications,
  ] = await Promise.all([
    prisma.iprFinance.count({ where }),
    prisma.iprFinance.count({ where: { ...where, auditStatus: 'approved' } }),
    prisma.iprFinance.count({ where: { ...where, auditStatus: 'rejected' } }),
    prisma.iprFinance.aggregate({
      where: { ...where, auditStatus: 'approved' },
      _sum: { incentiveAmount: true },
    }),
    prisma.iprApplication.count({
      where: { status: { in: ['drd_head_approved', 'under_finance_review'] } },
    }),
    prisma.iprApplication.count({ where: { status: 'completed' } }),
  ]);

  return {
    totalReviews,
    approved: approvedReviews,
    rejected: rejectedReviews,
    totalIncentivesAmount: totalIncentivesAmount._sum.incentiveAmount || 0,
    pendingApplications,
    completedApplications,
  };
};

/**
 * Get incentive history for an applicant
 */
const getApplicantIncentiveHistory = async (userId) => {
  const applications = await prisma.iprApplication.findMany({
    where: { applicantUserId: userId, status: 'completed' },
    include: {
      financeRecords: {
        where: { auditStatus: 'approved' },
        include: {
          financeReviewer: {
            select: {
              uid: true,
              employeeDetails: { select: { displayName: true } },
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  const totalIncentives = applications.reduce(
    (sum, app) => sum + (parseFloat(app.incentiveAmount) || 0),
    0
  );
  const totalPoints = applications.reduce(
    (sum, app) => sum + (app.pointsAwarded || 0),
    0
  );

  return {
    applications,
    totalIncentives,
    totalPoints,
    totalCompleted: applications.length,
  };
};

/**
 * Finance approve and process incentives
 */
const approveFinanceApplication = async (id, comments, userId) => {
  const application = await prisma.iprApplication.findUnique({
    where: { id },
    include: {
      reviews: {
        where: { reviewerRole: 'drd_member' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!application) {
    return { error: 'IPR application not found', status: 404 };
  }

  if (!['under_finance_review'].includes(application.status)) {
    return { error: 'Application is not ready for Finance processing. Current status: ' + application.status, status: 400 };
  }

  // Calculate incentive based on IPR type
  let incentiveAmount = 0;
  let pointsAwarded = 0;

  switch (application.iprType) {
    case 'patent':
      incentiveAmount = application.filingType === 'complete' ? 50000 : 25000;
      pointsAwarded = application.filingType === 'complete' ? 100 : 50;
      break;
    case 'copyright':
      incentiveAmount = 15000;
      pointsAwarded = 30;
      break;
    case 'trademark':
      incentiveAmount = 10000;
      pointsAwarded = 20;
      break;
    default:
      incentiveAmount = 5000;
      pointsAwarded = 10;
  }

  const financeRecord = await prisma.iprFinance.create({
    data: {
      iprApplicationId: id,
      financeReviewerId: userId,
      auditStatus: 'approved',
      auditComments: comments || 'Incentives approved and processed',
      incentiveAmount,
      pointsAwarded,
      paymentReference: `IPR_${application.iprType.toUpperCase()}_${Date.now()}`,
      creditedToAccount: application.applicantUser?.employeeDetails?.empId || 'PENDING',
      approvedAt: new Date(),
      creditedAt: new Date(),
    },
  });

  const updatedApplication = await prisma.iprApplication.update({
    where: { id },
    data: {
      status: 'completed',
      incentiveAmount,
      pointsAwarded,
      creditedAt: new Date(),
      completedAt: new Date(),
    },
    include: {
      applicantUser: { include: { employeeDetails: true, permissions: true } },
      applicantDetails: true,
      sdgs: true,
      school: true,
      department: true,
      reviews: {
        include: { reviewer: { include: { employeeDetails: true } } },
        orderBy: { createdAt: 'desc' }
      },
      financeRecords: {
        include: { financeReviewer: { include: { employeeDetails: true } } }
      }
    }
  });

  await prisma.iprReview.create({
    data: {
      iprApplicationId: id,
      reviewerId: userId,
      reviewerRole: 'finance',
      comments: comments || 'Incentives approved and processed',
      decision: 'approved',
      reviewedAt: new Date(),
    },
  });

  await prisma.iprStatusHistory.create({
    data: {
      iprApplicationId: id,
      fromStatus: application.status,
      toStatus: 'incentives_processed',
      changedById: userId,
      comments: comments || 'Finance approved - Incentives processed and credited',
      metadata: {
        incentiveAmount,
        pointsAwarded,
        paymentReference: financeRecord.paymentReference,
      },
    },
  });

  return { data: updatedApplication };
};

/**
 * Finance reject application
 */
const rejectFinanceApplication = async (id, comments, userId) => {
  if (!comments || !comments.trim()) {
    return { error: 'Comments are required for rejection', status: 400 };
  }

  const application = await prisma.iprApplication.findUnique({ where: { id } });
  if (!application) {
    return { error: 'IPR application not found', status: 404 };
  }

  await prisma.iprFinance.create({
    data: {
      iprApplicationId: id,
      financeReviewerId: userId,
      auditStatus: 'rejected',
      auditComments: comments,
      incentiveAmount: 0,
      pointsAwarded: 0,
    },
  });

  const updatedApplication = await prisma.iprApplication.update({
    where: { id },
    data: { status: 'finance_rejected', completedAt: new Date() },
    include: {
      applicantUser: { include: { employeeDetails: true, permissions: true } },
      applicantDetails: true,
      sdgs: true,
      school: true,
      department: true,
      reviews: {
        include: { reviewer: { include: { employeeDetails: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  await prisma.iprReview.create({
    data: {
      iprApplicationId: id,
      reviewerId: userId,
      reviewerRole: 'finance',
      comments,
      decision: 'rejected',
      reviewedAt: new Date(),
    },
  });

  await prisma.iprStatusHistory.create({
    data: {
      iprApplicationId: id,
      fromStatus: application.status,
      toStatus: 'finance_rejected',
      changedById: userId,
      comments,
    },
  });

  return { data: updatedApplication };
};

/**
 * Finance request additional audit
 */
const requestAdditionalAudit = async (id, comments, userId) => {
  if (!comments || !comments.trim()) {
    return { error: 'Comments are required for audit request', status: 400 };
  }

  const application = await prisma.iprApplication.findUnique({ where: { id } });
  if (!application) {
    return { error: 'IPR application not found', status: 404 };
  }

  await prisma.iprFinance.create({
    data: {
      iprApplicationId: id,
      financeReviewerId: userId,
      auditStatus: 'audit_requested',
      auditComments: comments,
      incentiveAmount: 0,
    },
  });

  const updatedApplication = await prisma.iprApplication.update({
    where: { id },
    data: {
      status: 'under_finance_review',
      currentReviewerId: userId,
    },
    include: {
      applicantUser: { include: { employeeDetails: true, permissions: true } },
      applicantDetails: true,
      sdgs: true,
      school: true,
      department: true,
      financeRecords: {
        include: { financeReviewer: { include: { employeeDetails: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  await prisma.iprStatusHistory.create({
    data: {
      iprApplicationId: id,
      fromStatus: application.status,
      toStatus: 'under_finance_review',
      changedById: userId,
      comments: `Additional audit requested: ${comments}`,
      metadata: { auditRequested: true },
    },
  });

  return { data: updatedApplication };
};

module.exports = {
  getPendingFinanceReviews,
  processFinanceIncentive,
  getFinanceStatistics,
  getApplicantIncentiveHistory,
  approveFinanceApplication,
  rejectFinanceApplication,
  requestAdditionalAudit,
};
