const prisma = require('../../../shared/config/database');

// Helper function to notify all contributors of an IPR application
const notifyContributors = async (iprApplicationId, notificationType, title, message, additionalMetadata = {}) => {
  try {
    // Get all contributors for this application
    const contributors = await prisma.iprContributor.findMany({
      where: { 
        iprApplicationId,
        userId: { not: null }  // Only notify internal users who have accounts
      },
      select: { userId: true, name: true }
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

    // Get user's DRD permissions to check assigned schools
    let userDrdPermission;
    try {
      // First find the DRD department flexibly
      const drdDept = await prisma.centralDepartment.findFirst({
        where: {
          OR: [
            { departmentCode: 'DRD' },
            { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
            { departmentName: { contains: 'DRD', mode: 'insensitive' } },
            { shortName: 'DRD' },
            { departmentName: { contains: 'Development', mode: 'insensitive' } },
            { departmentName: { contains: 'Research', mode: 'insensitive' } },
          ],
        },
      });
      
      if (drdDept) {
        userDrdPermission = await prisma.centralDepartmentPermission.findFirst({
          where: {
            userId,
            isActive: true,
            centralDeptId: drdDept.id
          },
          select: {
            permissions: true,
            assignedSchoolIds: true,
          }
        });
      }
    } catch (permError) {
      console.log('Note: Error fetching DRD permissions:', permError.message);
      userDrdPermission = null;
    }

    const permissions = userDrdPermission?.permissions || {};
    // Filter out null/undefined values from assignedSchoolIds to prevent Prisma errors
    const assignedSchoolIds = (userDrdPermission?.assignedSchoolIds || []).filter(id => id !== null && id !== undefined);
    const isDrdHead = permissions.ipr_approve === true || permissions.drd_ipr_approve === true;
    const isDrdMember = permissions.ipr_review === true || permissions.ipr_recommend === true || 
                        permissions.drd_ipr_review === true || permissions.drd_ipr_recommend === true;

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

    // Filter by IPR type if specified
    if (iprType) where.iprType = iprType;

    // School filtering logic
    if (schoolId) {
      // Explicit school filter from query
      where.schoolId = schoolId;
    } else if (!isDrdHead && isDrdMember && assignedSchoolIds.length > 0) {
      // DRD Member with assigned schools: can see:
      // 1. Applications from their assigned schools
      // 2. Applications with no school assigned (schoolId is null) - so they can review and assign
      // 3. Applications assigned to them as reviewer
      where.OR = [
        { schoolId: { in: assignedSchoolIds } },
        { schoolId: null },
        { currentReviewerId: userId }
      ];
    } else if (!isDrdHead && isDrdMember && assignedSchoolIds.length === 0) {
      // DRD Member with no assigned schools: see unassigned apps and their assigned applications
      where.OR = [
        { schoolId: null },
        { currentReviewerId: userId }
      ];
    }
    // DRD Head sees all schools (no school filter)

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
    console.error('Get pending DRD reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reviews',
      error: error.message,
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

    // Update application with reviewer
    await prisma.iprApplication.update({
      where: { id },
      data: {
        currentReviewerId: reviewerId,
        status: 'under_drd_review',
      },
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'under_drd_review',
        changedById: userId,
        comments: `Assigned to reviewer: ${reviewerId}`,
      },
    });

    res.json({
      success: true,
      message: 'Reviewer assigned successfully',
    });
  } catch (error) {
    console.error('Assign DRD reviewer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign reviewer',
      error: error.message,
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
        reviewerRole: 'drd_member',
        comments,
        edits: edits || {},
        decision,
        reviewedAt: new Date(),
      },
    });

    // Determine new status
    let newStatus;
    if (decision === 'approved') {
      newStatus = 'drd_head_approved';  // Direct approval - ready for govt filing
    } else if (decision === 'changes_required') {
      newStatus = 'changes_required';
    } else {
      newStatus = 'drd_rejected';
    }

    // Update application status
    await prisma.iprApplication.update({
      where: { id },
      data: {
        status: newStatus,
        ...(decision === 'approved' ? { approvedAt: new Date() } : {}),
      },
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: newStatus,
        changedById: userId,
        comments: `DRD review: ${decision}`,
      },
    });

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
      error: error.message,
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

    // Update application data and resubmit
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        ...updatedData,
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
      error: error.message,
    });
  }
};

// Get DRD review statistics
const getDrdReviewStatistics = async (req, res) => {
  try {
    const { reviewerId } = req.query;

    const where = reviewerId ? { reviewerId } : {};

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
          status: { in: ['submitted', 'under_drd_review', 'resubmitted'] },
        },
      }),
      // Applications awaiting DRD Head approval (recommended by member)
      prisma.iprApplication.count({
        where: {
          status: { in: ['recommended_to_head'] },
        },
      }),
      // All active applications in the pipeline (not completed or rejected)
      prisma.iprApplication.count({
        where: {
          status: { 
            notIn: ['draft', 'completed', 'drd_rejected', 'cancelled'] 
          },
        },
      }),
      // Completed/fully approved applications
      prisma.iprApplication.count({
        where: {
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
      error: error.message,
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

    // Update application status - DRD Head approved, submitted to govt for filing
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'submitted_to_govt',
        currentReviewerId: userId, // Assign to DRD Head for govt filing updates
      }
    });

    // Create final review record
    await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'drd_head',
        comments: comments || 'Application approved by DRD Head',
        decision: 'approved',
        reviewedAt: new Date()
      }
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'submitted_to_govt',
        changedById: userId,
        comments: comments || 'DRD Head approved - submitted to government for filing'
      }
    });

    // Notify applicant
    if (application.applicantUserId) {
      await prisma.notification.create({
        data: {
          userId: application.applicantUserId,
          type: 'ipr_approved',
          title: 'IPR Application Approved - Submitted to Government!',
          message: `Your IPR application "${application.title}" has been approved by DRD Head and submitted to government for filing.`,
          referenceType: 'ipr_application',
          referenceId: id,
          metadata: { newStatus: 'submitted_to_govt' }
        }
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
      error: error.message
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

    // Update application with final rejection
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'drd_rejected',
        completedAt: new Date()
      }
    });

    // Create final review record
    await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'drd_approver',
        comments,
        decision: 'rejected',
        reviewedAt: new Date()
      }
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'drd_rejected',
        changedById: userId,
        comments: `Final rejection by DRD: ${comments}`
      }
    });

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
      error: error.message
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

    // Update application to changes required
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'changes_required',
        currentReviewerId: userId
      }
    });

    // Create review record
    await prisma.iprReview.create({
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

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'changes_required',
        changedById: userId,
        comments: `Changes requested: ${comments}`
      }
    });

    // Send notification to applicant
    await prisma.notification.create({
      data: {
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
      }
    });

    // Notify all contributors
    await notifyContributors(
      id,
      'ipr_changes_requested',
      'Changes Requested for IPR Application',
      `Changes have been requested for IPR "${application.title}". Comments: ${comments.substring(0, 100)}${comments.length > 100 ? '...' : ''}`,
      { actionUrl: `/ipr/my-applications/${id}` }
    );

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
      error: error.message
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
      error: error.message
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

    // Update status to recommended_to_head
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'recommended_to_head',
        currentReviewerId: userId
      },
      include: {
        applicantDetails: true,
        contributors: true,
        sdgs: true
      }
    });

    // Create review record
    await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'drd_member',
        comments: comments || 'Recommended to DRD Head for approval',
        decision: 'recommended',
        reviewedAt: new Date()
      }
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'recommended_to_head',
        changedById: userId,
        comments: comments || 'Application recommended to DRD Head'
      }
    });

    // Notify contributors
    await notifyContributors(
      id,
      'ipr_status_change',
      'IPR Application Recommended',
      `The IPR application "${application.title}" has been recommended to DRD Head for approval.`,
      { newStatus: 'recommended_to_head' }
    );

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
      error: error.message
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

    // Update status to submitted_to_govt
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'submitted_to_govt',
        currentReviewerId: userId
      },
      include: {
        applicantDetails: true,
        contributors: true,
        sdgs: true
      }
    });

    // Create review record
    await prisma.iprReview.create({
      data: {
        iprApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'drd_head',
        comments: comments || 'Approved and submitted to Government',
        decision: 'approved',
        reviewedAt: new Date()
      }
    });

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'submitted_to_govt',
        changedById: userId,
        comments: 'DRD Head approved - Submitted to Government'
      }
    });

    // Notify contributors
    await notifyContributors(
      id,
      'ipr_status_change',
      'IPR Approved - Submitted to Government',
      `Great news! The IPR application "${application.title}" has been approved by DRD Head and submitted to Government.`,
      { newStatus: 'submitted_to_govt' }
    );

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
      error: error.message
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

    // Update with govt application ID
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        govtApplicationId,
        govtFilingDate: govtFilingDate ? new Date(govtFilingDate) : new Date(),
        status: 'govt_application_filed'
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
        toStatus: 'govt_application_filed',
        changedById: userId,
        comments: `Government Application ID added: ${govtApplicationId}`,
        metadata: { govtApplicationId, govtFilingDate }
      }
    });

    // Notify applicant
    if (application.applicantUserId) {
      await prisma.notification.create({
        data: {
          userId: application.applicantUserId,
          type: 'ipr_govt_filed',
          title: 'Government Application Filed',
          message: `Your IPR application "${application.title}" has been filed with the Government. Application ID: ${govtApplicationId}`,
          referenceType: 'ipr_application',
          referenceId: id,
          metadata: { govtApplicationId }
        }
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
      error: error.message
    });
  }
};

// Incentive Policy defaults
const DEFAULT_INCENTIVE_POLICIES = {
  patent: { baseIncentiveAmount: 50000, basePoints: 50, splitPolicy: 'equal' },
  copyright: { baseIncentiveAmount: 15000, basePoints: 20, splitPolicy: 'equal' },
  trademark: { baseIncentiveAmount: 10000, basePoints: 15, splitPolicy: 'equal' },
  design: { baseIncentiveAmount: 20000, basePoints: 25, splitPolicy: 'equal' }
};

// Helper function to calculate and credit incentives to inventors
const creditIncentivesToInventors = async (application, userId) => {
  try {
    const iprType = application.iprType?.toLowerCase() || 'patent';
    
    // Get active policy or use default
    let policy = await prisma.incentivePolicy.findFirst({
      where: {
        iprType: iprType,
        isActive: true
      }
    });

    if (!policy) {
      policy = DEFAULT_INCENTIVE_POLICIES[iprType] || DEFAULT_INCENTIVE_POLICIES.patent;
    }

    const totalIncentive = Number(policy.baseIncentiveAmount);
    const totalPoints = Number(policy.basePoints);

    // Get all inventors (contributors with role 'inventor' or the applicant)
    const contributors = await prisma.iprContributor.findMany({
      where: {
        iprApplicationId: application.id,
        role: { in: ['inventor', 'co-inventor', 'primary_inventor', 'co_inventor'] }
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: { firstName: true, lastName: true, displayName: true }
            }
          }
        }
      }
    });

    // If no contributors found, use the applicant as the sole inventor
    let inventors = contributors.filter(c => c.userId);
    
    // Add applicant if not already in the list
    if (application.applicantUserId) {
      const applicantInList = inventors.some(i => i.userId === application.applicantUserId);
      if (!applicantInList) {
        inventors.push({
          userId: application.applicantUserId,
          name: 'Applicant',
          role: 'primary_inventor'
        });
      }
    }

    const inventorCount = inventors.length || 1;
    
    // Calculate per-inventor share (equal split)
    const perInventorIncentive = Math.floor(totalIncentive / inventorCount);
    const perInventorPoints = Math.floor(totalPoints / inventorCount);

    // Notify and track each inventor
    for (const inventor of inventors) {
      if (inventor.userId) {
        // Notify the inventor about their credited incentive
        await prisma.notification.create({
          data: {
            userId: inventor.userId,
            type: 'incentive_credited',
            title: 'Incentive Credited! 💰',
            message: `Congratulations! ₹${perInventorIncentive.toLocaleString()} and ${perInventorPoints} research points have been credited for your contribution to "${application.title}".`,
            referenceType: 'ipr_application',
            referenceId: application.id,
            metadata: {
              incentiveAmount: perInventorIncentive,
              pointsAwarded: perInventorPoints,
              publicationId: application.publicationId,
              totalInventors: inventorCount
            }
          }
        });
      }
    }

    return {
      totalIncentive,
      totalPoints,
      perInventorIncentive,
      perInventorPoints,
      inventorCount
    };
  } catch (error) {
    console.error('Error crediting incentives:', error);
    throw error;
  }
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

      return res.json({
        success: true,
        message: 'Rejection reference added successfully',
        data: updated
      });
    }

    // Original publication flow (for successful applications)
    // Calculate incentives based on policy
    const iprType = application.iprType?.toLowerCase() || 'patent';
    let policy = await prisma.incentivePolicy.findFirst({
      where: { iprType, isActive: true }
    });
    if (!policy) {
      policy = DEFAULT_INCENTIVE_POLICIES[iprType] || DEFAULT_INCENTIVE_POLICIES.patent;
    }

    const totalIncentive = Number(policy.baseIncentiveAmount);
    const totalPoints = Number(policy.basePoints);

    // Count inventors to calculate split
    const inventors = application.contributors?.filter(c => 
      ['inventor', 'co-inventor', 'primary_inventor', 'co_inventor'].includes(c.role)
    ) || [];
    
    // Include applicant if not already counted
    let inventorCount = inventors.filter(i => i.userId).length;
    if (application.applicantUserId) {
      const applicantInList = inventors.some(i => i.userId === application.applicantUserId);
      if (!applicantInList) {
        inventorCount++;
      }
    }
    inventorCount = Math.max(inventorCount, 1); // At least 1
    
    // Calculate per-inventor share
    const perInventorIncentive = Math.floor(totalIncentive / inventorCount);
    const perInventorPoints = Math.floor(totalPoints / inventorCount);

    // Update application with publication ID - mark as PUBLISHED (completed)
    // Store per-inventor share (what each inventor receives)
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        publicationId,
        publicationDate: publicationDate ? new Date(publicationDate) : new Date(),
        status: 'published',
        completedAt: new Date(),
        incentiveAmount: perInventorIncentive,
        pointsAwarded: perInventorPoints,
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

    // Credit incentives to all inventors
    const incentiveResult = await creditIncentivesToInventors(updated, userId);

    // Create status history
    await prisma.iprStatusHistory.create({
      data: {
        iprApplicationId: id,
        fromStatus: application.status,
        toStatus: 'published',
        changedById: userId,
        comments: `Publication ID added: ${publicationId}. Total Incentive: ₹${totalIncentive} and ${totalPoints} points. Each inventor receives: ₹${perInventorIncentive} and ${perInventorPoints} points (split among ${inventorCount} inventor(s))`,
        metadata: { 
          publicationId, 
          publicationDate,
          totalIncentive,
          totalPoints,
          perInventorIncentive,
          perInventorPoints,
          inventorCount
        }
      }
    });

    // Notify applicant
    if (application.applicantUserId) {
      await prisma.notification.create({
        data: {
          userId: application.applicantUserId,
          type: 'ipr_published',
          title: 'IPR Published & Incentives Credited! 🎉💰',
          message: `Congratulations! Your IPR "${application.title}" has been published. Publication ID: ${publicationId}. Incentives (₹${incentiveResult.perInventorIncentive.toLocaleString()} and ${incentiveResult.perInventorPoints} points) have been credited to all inventors.`,
          referenceType: 'ipr_application',
          referenceId: id,
          metadata: { 
            publicationId,
            incentiveAmount: incentiveResult.perInventorIncentive,
            pointsAwarded: incentiveResult.perInventorPoints
          }
        }
      });
    }

    // Notify other contributors
    await notifyContributors(
      id,
      'ipr_published',
      'IPR Published & Incentives Credited! 🎉💰',
      `The IPR "${application.title}" has been published. Publication ID: ${publicationId}. Your share: ₹${incentiveResult.perInventorIncentive.toLocaleString()} and ${incentiveResult.perInventorPoints} points.`,
      { 
        publicationId, 
        newStatus: 'published',
        incentiveAmount: incentiveResult.perInventorIncentive,
        pointsAwarded: incentiveResult.perInventorPoints
      }
    );

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
      error: error.message
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

    // Update application status to govt_rejected
    const updated = await prisma.iprApplication.update({
      where: { id },
      data: {
        status: 'govt_rejected',
      }
    });

    // Create status history
    await prisma.iprStatusHistory.create({
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

    // Notify applicant about rejection
    if (application.applicantUserId) {
      await prisma.notification.create({
        data: {
          userId: application.applicantUserId,
          type: 'ipr_govt_rejected',
          title: 'IPR Application Rejected by Government',
          message: `Your IPR "${application.title}" has been rejected by the government. Reason: ${comments}. Please contact DRD for more details.`,
          referenceType: 'ipr_application',
          referenceId: id,
          metadata: { 
            rejectionReason: comments
          }
        }
      });
    }

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
      error: error.message
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
      // Notify all inventors/contributors
      for (const contributor of iprApplication.contributors) {
        if (contributor.userId && contributor.userId !== iprApplication.applicantUser.id) {
          await prisma.notification.create({
            data: {
              userId: contributor.userId,
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
      error: error.message,
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

    // Check if user has access to this application
    const iprApplication = await prisma.iprApplication.findFirst({
      where: {
        id,
        OR: [
          { applicantUserId: userId }, // Applicant
          { contributors: { some: { userId } } }, // Contributor/Inventor
        ]
      }
    });

    // If not applicant/inventor, check DRD permissions
    if (!iprApplication) {
      const drdDept = await prisma.centralDepartment.findFirst({
        where: {
          OR: [
            { departmentCode: 'DRD' },
            { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
            { shortName: 'DRD' },
          ],
        },
      });

      if (drdDept) {
        const userDrdPermission = await prisma.centralDepartmentPermission.findFirst({
          where: {
            userId,
            centralDeptId: drdDept.id,
            isActive: true,
          }
        });

        if (!userDrdPermission) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view updates for this application',
          });
        }
      }
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
      error: error.message,
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
      // Check DRD head permissions
      const drdDept = await prisma.centralDepartment.findFirst({
        where: {
          OR: [
            { departmentCode: 'DRD' },
            { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          ],
        },
      });

      if (drdDept) {
        const userDrdPermission = await prisma.centralDepartmentPermission.findFirst({
          where: {
            userId,
            centralDeptId: drdDept.id,
            isActive: true,
          },
          select: { permissions: true }
        });

        const permissions = userDrdPermission?.permissions || {};
        const isDrdHead = permissions.ipr_approve === true || permissions.drd_ipr_approve === true;

        if (!isDrdHead) {
          return res.status(403).json({
            success: false,
            message: 'You can only delete your own status updates',
          });
        }
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
      error: error.message,
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