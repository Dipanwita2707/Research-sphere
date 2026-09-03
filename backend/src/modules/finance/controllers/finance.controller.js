const prisma = require('../../../shared/config/database');

// Get all IPR applications pending for Finance review
const getPendingFinanceReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, iprType, schoolId } = req.query;

    const where = {
      // After DRD Head approval and publication, comes to Finance
      status: { in: ['under_finance_review'] },
    };
    if (req.tenantId) {
      where.applicantUser = { universityId: req.tenantId };
    }
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
            select: {
              facultyName: true,
              facultyCode: true,
            },
          },
          department: {
            select: {
              departmentName: true,
              departmentCode: true,
            },
          },
          reviews: {
            include: {
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
            orderBy: {
              createdAt: 'desc',
            },
          },
          financeRecords: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          submittedAt: 'asc',
        },
      }),
      prisma.iprApplication.count({ where }),
    ]);

    res.json({
      success: true,
      data: applications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get pending Finance reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending finance reviews',
      error: error.message,
    });
  }
};

// Process finance audit and incentive
const processFinanceIncentive = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      auditStatus,
      auditComments,
      incentiveAmount,
      pointsAwarded,
      paymentReference,
      creditedToAccount,
    } = req.body;
    const userId = req.user.id;

    // Validate audit status
    if (!['approved', 'rejected'].includes(auditStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audit status. Must be approved or rejected',
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

    // Create finance record
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

    // Determine new status
    const newStatus = auditStatus === 'approved' ? 'completed' : 'finance_rejected';

    // Update application status and incentive details
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

    // Create review record
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

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: newStatus,
        changedById: userId,
        comments: `Finance audit: ${auditStatus}`,
        metadata: {
          incentiveAmount,
          pointsAwarded,
          paymentReference,
        },
      },
    });

    res.json({
      success: true,
      message: `Finance processing completed (${auditStatus})`,
      data: financeRecord,
    });
  } catch (error) {
    console.error('Process finance incentive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process finance incentive',
      error: error.message,
    });
  }
};

// Get finance statistics
const getFinanceStatistics = async (req, res) => {
  try {
    const { reviewerId } = req.query;
    const tenantId = req.tenantId || null;
    const tenantWhere = tenantId
      ? { iprApplication: { applicantUser: { universityId: tenantId } } }
      : {};

    const where = reviewerId ? { financeReviewerId: reviewerId, ...tenantWhere } : tenantWhere;

    const [
      totalReviews,
      approvedReviews,
      rejectedReviews,
      totalIncentivesAmount,
      pendingApplications,
      completedApplications,
    ] = await Promise.all([
      prisma.iprFinance.count({ where }),
      prisma.iprFinance.count({
        where: {
          ...where,
          auditStatus: 'approved',
        },
      }),
      prisma.iprFinance.count({
        where: {
          ...where,
          auditStatus: 'rejected',
        },
      }),
      prisma.iprFinance.aggregate({
        where: {
          ...where,
          auditStatus: 'approved',
        },
        _sum: {
          incentiveAmount: true,
        },
      }),
      prisma.iprApplication.count({
        where: {
          status: { in: ['drd_head_approved', 'under_finance_review'] },
          ...(tenantId ? { applicantUser: { universityId: tenantId } } : {}),
        },
      }),
      prisma.iprApplication.count({
        where: {
          status: 'completed',
          ...(tenantId ? { applicantUser: { universityId: tenantId } } : {}),
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalReviews,
        approved: approvedReviews,
        rejected: rejectedReviews,
        totalIncentivesAmount: totalIncentivesAmount._sum.incentiveAmount || 0,
        pendingApplications,
        completedApplications,
      },
    });
  } catch (error) {
    console.error('Get Finance statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message,
    });
  }
};

// Get incentive history for an applicant
const getApplicantIncentiveHistory = async (req, res) => {
  try {
    const userId = req.params.applicantId || req.query.userId || req.user.id;

    const applications = await prisma.iprApplication.findMany({
      where: {
        applicantUserId: userId,
        status: 'completed',
        ...(req.tenantId ? { applicantUser: { universityId: req.tenantId } } : {}),
      },
      include: {
        financeRecords: {
          where: {
            auditStatus: 'approved',
          },
          include: {
            financeReviewer: {
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
        completedAt: 'desc',
      },
    });

    // Calculate totals
    const totalIncentives = applications.reduce(
      (sum, app) => sum + (parseFloat(app.incentiveAmount) || 0),
      0
    );
    const totalPoints = applications.reduce(
      (sum, app) => sum + (app.pointsAwarded || 0),
      0
    );

    res.json({
      success: true,
      data: {
        applications,
        totalIncentives,
        totalPoints,
        totalCompleted: applications.length,
      },
    });
  } catch (error) {
    console.error('Get applicant incentive history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incentive history',
      error: error.message,
    });
  }
};

// Finance approve and process incentives
const approveFinanceApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    // Check if application exists
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
      return res.status(404).json({
        success: false,
        message: 'IPR application not found',
      });
    }

    // Check if application can be processed by finance
    if (!['under_finance_review'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Application is not ready for Finance processing. Current status: ' + application.status,
      });
    }

    // Calculate incentive based on IPR type (you can customize this logic)
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

    // Create finance record
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

    // Update application status to completed
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
        applicantUser: {
          include: {
            employeeDetails: true,
            permissions: true
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
        },
        financeRecords: {
          include: {
            financeReviewer: {
              include: {
                employeeDetails: true
              }
            }
          }
        }
      }
    });

    // Create review record
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

    // Create status history
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

    res.json({
      success: true,
      message: 'Incentives processed successfully and credited to applicant',
      data: updatedApplication,
    });
  } catch (error) {
    console.error('Finance approve application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process incentives',
      error: error.message,
    });
  }
};

// Finance reject application
const rejectFinanceApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required for rejection',
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

    // Create finance record
    const financeRecord = await prisma.iprFinance.create({
      data: {
        iprApplicationId: id,
        financeReviewerId: userId,
        auditStatus: 'rejected',
        auditComments: comments,
        incentiveAmount: 0,
        pointsAwarded: 0,
      },
    });

    // Update application status
    const updatedApplication = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'finance_rejected',
        completedAt: new Date(),
      },
      include: {
        applicantUser: {
          include: {
            employeeDetails: true,
            permissions: true
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

    // Create review record
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

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'finance_rejected',
        changedById: userId,
        comments,
      },
    });

    res.json({
      success: true,
      message: 'Application rejected by Finance',
      data: updatedApplication,
    });
  } catch (error) {
    console.error('Finance reject application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject application',
      error: error.message,
    });
  }
};

// Finance request additional audit
const requestAdditionalAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    if (!comments || !comments.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required for audit request',
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

    // Create finance record for audit request
    const financeRecord = await prisma.iprFinance.create({
      data: {
        iprApplicationId: id,
        financeReviewerId: userId,
        auditStatus: 'audit_requested',
        auditComments: comments,
        incentiveAmount: 0,
      },
    });

    // Update application status to keep it in finance review but mark audit
    const updatedApplication = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'under_finance_review', // Keep in finance queue with audit flag
        currentReviewerId: userId,
      },
      include: {
        applicantUser: {
          include: {
            employeeDetails: true,
            permissions: true
          }
        },
        applicantDetails: true,
        sdgs: true,
        school: true,
        department: true,
        financeRecords: {
          include: {
            financeReviewer: {
              include: {
                employeeDetails: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'under_finance_review',
        changedById: userId,
        comments: `Additional audit requested: ${comments}`,
        metadata: {
          auditRequested: true,
        },
      },
    });

    res.json({
      success: true,
      message: 'Additional audit requested successfully',
      data: updatedApplication,
    });
  } catch (error) {
    console.error('Request additional audit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request additional audit',
      error: error.message,
    });
  }
};

module.exports = {
  getPendingFinanceReviews,
  processFinanceIncentive,
  approveFinanceApplication,
  rejectFinanceApplication,
  requestAdditionalAudit,
  getFinanceStatistics,
  getApplicantIncentiveHistory,
};
