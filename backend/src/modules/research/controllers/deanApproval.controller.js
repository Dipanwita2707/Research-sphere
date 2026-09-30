/**
 * @deprecated This controller is DEPRECATED. 
 * Dean approval layer has been removed from the IPR workflow.
 * The workflow is now: Applicant → DRD Member → DRD Head → Govt Filing → Finance
 * 
 * These functions are kept for backward compatibility with any existing data
 * but should not be used for new functionality.
 * 
 * Use drdReview.controller.js for DRD Member and DRD Head functions instead.
 */

const prisma = require('../../../shared/config/database');

// Get all IPR applications pending for Dean approval
const getPendingDeanApprovals = async (req, res) => {
  try {
    const { page = 1, limit = 10, iprType, schoolId } = req.query;

    const where = {
      status: { in: ['drd_approved', 'under_dean_review'] },
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
    console.error('Get pending Dean approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
    });
  }
};

// Submit Dean approval/rejection
const submitDeanDecision = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    const userId = req.user.id;

    // Validate decision
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be approved or rejected',
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

    // Create review record
    const review = await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'drd_dean',
        comments,
        decision,
        reviewedAt: new Date(),
      },
    });

    // Determine new status
    const newStatus = decision === 'approved' ? 'dean_approved' : 'dean_rejected';

    // Update application status
    await prisma.iprApplication.update({
      where: { id },
      data: {
        status: newStatus,
        currentReviewerId: decision === 'approved' ? null : userId, // Clear if approved for finance
      },
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: newStatus,
        changedById: userId,
        comments: `Dean decision: ${decision}`,
      },
    });

    res.json({
      success: true,
      message: `Dean decision (${decision}) submitted successfully`,
      data: review,
    });
  } catch (error) {
    console.error('Submit Dean decision error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit decision',
    });
  }
};

// Get Dean approval statistics
const getDeanApprovalStatistics = async (req, res) => {
  try {
    const { reviewerId } = req.query;

    const where = reviewerId ? { reviewerId } : {};

    const [
      totalReviews,
      approvedReviews,
      rejectedReviews,
      pendingApplications,
    ] = await Promise.all([
      prisma.iprReview.count({
        where: {
          ...where,
          reviewerRole: 'drd_dean',
        },
      }),
      prisma.iprReview.count({
        where: {
          ...where,
          reviewerRole: 'drd_dean',
          decision: 'approved',
        },
      }),
      prisma.iprReview.count({
        where: {
          ...where,
          reviewerRole: 'drd_dean',
          decision: 'rejected',
        },
      }),
      prisma.iprApplication.count({
        where: {
          status: { in: ['drd_approved', 'under_dean_review'] },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalReviews,
        approved: approvedReviews,
        rejected: rejectedReviews,
        pendingApplications,
      },
    });
  } catch (error) {
    console.error('Get Dean approval statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
    });
  }
};

// Dean approve application and send to Finance
const approveDeanApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
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

    // Check if application can be approved by dean
    if (!['drd_approved', 'under_dean_review'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Application is not ready for Dean approval',
      });
    }

    // Create review record
    const review = await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'drd_dean',
        comments,
        decision: 'approved',
        reviewedAt: new Date(),
      },
    });

    // Update application status to send to Finance
    const updatedApplication = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'under_finance_review',
        currentReviewerId: null, // Will be assigned by finance team
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
        },
        statusHistory: {
          include: {
            changedBy: {
              include: {
                employeeDetails: true
              }
            }
          },
          orderBy: { changedAt: 'desc' }
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

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'under_finance_review',
        changedById: userId,
        comments: comments || 'Dean approved - sent to Finance for incentive processing',
      },
    });

    res.json({
      success: true,
      message: 'Application approved by Dean and sent to Finance',
      data: updatedApplication,
    });
  } catch (error) {
    console.error('Dean approve application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve application',
    });
  }
};

// Dean reject application
const rejectDeanApplication = async (req, res) => {
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

    // Check if application can be rejected by dean
    if (!['drd_approved', 'under_dean_review'].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: 'Application cannot be rejected in its current status',
      });
    }

    // Create review record
    const review = await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'drd_dean',
        comments,
        decision: 'rejected',
        reviewedAt: new Date(),
      },
    });

    // Update application status
    const updatedApplication = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'dean_rejected',
        currentReviewerId: userId,
        completedAt: new Date(),
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
        },
        statusHistory: {
          include: {
            changedBy: {
              include: {
                employeeDetails: true
              }
            }
          },
          orderBy: { changedAt: 'desc' }
        }
      }
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'dean_rejected',
        changedById: userId,
        comments,
      },
    });

    res.json({
      success: true,
      message: 'Application rejected by Dean',
      data: updatedApplication,
    });
  } catch (error) {
    console.error('Dean reject application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject application',
    });
  }
};

module.exports = {
  getPendingDeanApprovals,
  submitDeanDecision,
  approveDeanApplication,
  rejectDeanApplication,
  getDeanApprovalStatistics,
};
