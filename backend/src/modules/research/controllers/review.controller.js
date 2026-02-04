/**
 * Research Review Controller
 * Handles DRD review workflow for research contributions
 * Flow: submitted → under_review → [changes_required → resubmitted] → approved → completed
 */

const prisma = require('../../../shared/config/database');
const { logResearchFiling, logResearchUpdate, logResearchStatusChange, getIp } = require('../../../shared/utils/auditLogger');

/**
 * Get pending research contributions for review
 * Filters by assigned schools based on user's permissions
 */
exports.getPendingReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, publicationType, schoolId } = req.query;

    // Handle grants separately - they use a different table
    if (publicationType === 'grant_proposal') {
      return exports.getPendingGrantReviews(req, res);
    }

    // If no publicationType specified, fetch both research contributions AND grants
    if (!publicationType || publicationType === '') {
      return exports.getAllPendingReviews(req, res);
    }

    // Get user's DRD permissions and assigned schools
    let userDrdPermission = null;
    try {
      const drdDept = await prisma.centralDepartment.findFirst({
        where: {
          OR: [
            { departmentCode: 'DRD' },
            { departmentCode: 'drd' },
            { shortName: 'DRD' }
          ]
        }
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
            assignedResearchSchoolIds: true,
            assignedBookSchoolIds: true,
            assignedConferenceSchoolIds: true
          }
        });
      }
    } catch (permError) {
      console.log('Note: Error fetching DRD permissions:', permError.message);
    }

    const permissions = userDrdPermission?.permissions || {};
    const assignedResearchSchoolIds = userDrdPermission?.assignedResearchSchoolIds || [];
    const assignedBookSchoolIds = userDrdPermission?.assignedBookSchoolIds || [];
    const assignedConferenceSchoolIds = userDrdPermission?.assignedConferenceSchoolIds || [];

    // Check research/book/conference permissions
    const hasApprovePermission = permissions.research_approve === true || 
                                  permissions.book_approve === true || 
                                  permissions.conference_approve === true;
    const hasReviewPermission = permissions.research_review === true || 
                                 permissions.book_review === true || 
                                 permissions.conference_review === true;
    
    // Specific permissions
    const hasResearchReview = permissions.research_review === true;
    const hasResearchApprove = permissions.research_approve === true;
    const hasBookReview = permissions.book_review === true;
    const hasBookApprove = permissions.book_approve === true;
    const hasConferenceReview = permissions.conference_review === true;
    const hasConferenceApprove = permissions.conference_approve === true;

    console.log(`User ${userId} DRD permissions:`, {
      hasReviewPerm: hasReviewPermission,
      hasApprovePerm: hasApprovePermission,
      permissions
    });

    if (!hasApprovePermission && !hasReviewPermission) {
      console.log(`Access denied for user ${userId} - No research permissions`);
      // Return empty results instead of 403 to allow getAllPendingReviews to work
      return res.status(200).json({
        success: true,
        data: {
          contributions: [],
          stats: {
            submitted: 0,
            underReview: 0,
            changesRequired: 0,
            resubmitted: 0,
            recommended: 0,
            approved: 0,
            total: 0
          },
          userPermissions: {
            hasApprovePermission: false,
            hasReviewPermission: false,
            canReview: false,
            canApprove: false
          }
        }
      });
    }

    // Build status filter based on permissions
    const pendingStatuses = ['submitted', 'under_review', 'resubmitted', 'changes_required'];
    let whereClause = {};

    if (hasApprovePermission && !hasReviewPermission) {
      // ONLY approve permission: Show recommended contributions + contributions they've approved
      // Get IDs of contributions with recommended reviews (pending approval)
      const recommendedContributions = await prisma.researchContributionReview.findMany({
        where: {
          decision: 'recommended'
        },
        select: {
          researchContributionId: true
        },
        distinct: ['researchContributionId']
      });

      const recommendedIds = recommendedContributions.map(r => r.researchContributionId);

      // Get contributions this user has approved
      const approvedByUser = await prisma.researchContributionReview.findMany({
        where: {
          reviewerId: userId,
          decision: 'approved'
        },
        select: {
          researchContributionId: true
        },
        distinct: ['researchContributionId']
      });

      const approvedIds = approvedByUser.map(r => r.researchContributionId);

      // Combine both lists
      const allRelevantIds = [...new Set([...recommendedIds, ...approvedIds])];

      whereClause = {
        AND: [
          {
            id: { in: allRelevantIds.length > 0 ? allRelevantIds : ['none'] }
          },
          {
            status: {
              in: status ? [status] : ['under_review', 'approved', 'completed']
            }
          }
        ]
      };
    } else if (hasReviewPermission && !hasApprovePermission) {
      // ONLY review permission: Show based on assigned schools for different publication types
      const allAssignedSchools = [
        ...assignedResearchSchoolIds,
        ...assignedBookSchoolIds,
        ...assignedConferenceSchoolIds
      ];
      
      if (allAssignedSchools.length > 0) {
        // Build OR conditions for each publication type with their respective assigned schools
        const schoolOrConditions = [];
        
        if (assignedResearchSchoolIds.length > 0 && hasResearchReview) {
          schoolOrConditions.push({
            AND: [
              { publicationType: 'research_paper' },
              {
                OR: [
                  { schoolId: { in: assignedResearchSchoolIds } },
                  { schoolId: null }
                ]
              }
            ]
          });
        }
        
        if (assignedBookSchoolIds.length > 0 && hasBookReview) {
          schoolOrConditions.push({
            AND: [
              { publicationType: { in: ['book', 'book_chapter'] } },
              {
                OR: [
                  { schoolId: { in: assignedBookSchoolIds } },
                  { schoolId: null }
                ]
              }
            ]
          });
        }
        
        if (assignedConferenceSchoolIds.length > 0 && hasConferenceReview) {
          schoolOrConditions.push({
            AND: [
              { publicationType: 'conference_paper' },
              {
                OR: [
                  { schoolId: { in: assignedConferenceSchoolIds } },
                  { schoolId: null }
                ]
              }
            ]
          });
        }
        
        whereClause = {
          AND: [
            {
              status: {
                in: status ? [status] : pendingStatuses
              }
            },
            {
              OR: schoolOrConditions.length > 0 ? schoolOrConditions : [{ id: 'none' }]
            }
          ]
        };
      } else {
        // No assigned schools - can see all pending
        whereClause = {
          status: {
            in: status ? [status] : pendingStatuses
          }
        };
      }
    } else {
      // BOTH permissions: Show school-based reviews + all recommended contributions
      const recommendedContributions = await prisma.researchContributionReview.findMany({
        where: {
          decision: 'recommended'
        },
        select: {
          researchContributionId: true
        },
        distinct: ['researchContributionId']
      });

      const recommendedIds = recommendedContributions.map(r => r.researchContributionId);
      
      const allAssignedSchools = [
        ...assignedResearchSchoolIds,
        ...assignedBookSchoolIds,
        ...assignedConferenceSchoolIds
      ];

      if (allAssignedSchools.length > 0) {
        // Build OR conditions for each publication type with their respective assigned schools
        const schoolOrConditions = [];
        
        if (assignedResearchSchoolIds.length > 0 && (hasResearchReview || hasResearchApprove)) {
          schoolOrConditions.push({
            AND: [
              { publicationType: 'research_paper' },
              {
                OR: [
                  { schoolId: { in: assignedResearchSchoolIds } },
                  { schoolId: null }
                ]
              }
            ]
          });
        }
        
        if (assignedBookSchoolIds.length > 0 && (hasBookReview || hasBookApprove)) {
          schoolOrConditions.push({
            AND: [
              { publicationType: { in: ['book', 'book_chapter'] } },
              {
                OR: [
                  { schoolId: { in: assignedBookSchoolIds } },
                  { schoolId: null }
                ]
              }
            ]
          });
        }
        
        if (assignedConferenceSchoolIds.length > 0 && (hasConferenceReview || hasConferenceApprove)) {
          schoolOrConditions.push({
            AND: [
              { publicationType: 'conference_paper' },
              {
                OR: [
                  { schoolId: { in: assignedConferenceSchoolIds } },
                  { schoolId: null }
                ]
              }
            ]
          });
        }
        
        // Add recommended contributions
        if (recommendedIds.length > 0) {
          schoolOrConditions.push({ id: { in: recommendedIds } });
        }
        
        // Show: assigned schools + all recommended
        whereClause = {
          AND: [
            {
              status: {
                in: status ? [status] : [...pendingStatuses, 'approved']
              }
            },
            {
              OR: schoolOrConditions.length > 0 ? schoolOrConditions : [{ id: 'none' }]
            }
          ]
        };
      } else {
        // No assigned schools - show all
        whereClause = {
          status: {
            in: status ? [status] : [...pendingStatuses, 'approved']
          }
        };
      }
    }

    // Add publication type filter (merge into existing AND clause if present)
    if (publicationType) {
      if (whereClause.AND) {
        whereClause.AND.push({ publicationType });
      } else {
        whereClause.publicationType = publicationType;
      }
    }

    // Add school filter (merge into existing AND clause if present)
    if (schoolId) {
      if (whereClause.AND) {
        whereClause.AND.push({ schoolId });
      } else {
        whereClause.schoolId = schoolId;
      }
    }

    const contributions = await prisma.researchContribution.findMany({
      where: whereClause,
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
                displayName: true,
                designation: true
              }
            }
          }
        },
        applicantDetails: true,
        authors: true,
        school: {
          select: {
            id: true,
            facultyName: true,
            shortName: true
          }
        },
        department: {
          select: {
            id: true,
            departmentName: true,
            shortName: true
          }
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            reviewer: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    designation: true
                  }
                }
              }
            }
          }
        },
        editSuggestions: {
          where: { status: 'pending' }
        }
      },
      orderBy: { submittedAt: 'asc' }
    });

    // Get statistics
    const stats = {
      submitted: contributions.filter(c => c.status === 'submitted').length,
      underReview: contributions.filter(c => c.status === 'under_review').length,
      changesRequired: contributions.filter(c => c.status === 'changes_required').length,
      resubmitted: contributions.filter(c => c.status === 'resubmitted').length,
      approved: contributions.filter(c => c.status === 'approved').length,
      total: contributions.length
    };

    // Add recommendation status to each contribution
    const enrichedContributions = contributions.map(contrib => {
      const latestReview = contrib.reviews?.[0];
      const isRecommended = latestReview?.decision === 'recommended';
      
      return {
        ...contrib,
        isRecommended,
        awaitingFinalApproval: isRecommended && contrib.status === 'under_review'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        contributions: enrichedContributions,
        stats,
        userPermissions: {
          hasApprovePermission,
          hasReviewPermission,
          assignedResearchSchoolIds,
          assignedBookSchoolIds,
          assignedConferenceSchoolIds,
          assignedSchoolIds: assignedResearchSchoolIds, // Backward compatibility
          canReview: hasReviewPermission,
          canApprove: hasApprovePermission,
          hasResearchReview,
          hasResearchApprove,
          hasBookReview,
          hasBookApprove,
          hasConferenceReview,
          hasConferenceApprove
        }
      }
    });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending reviews',
      error: error.message
    });
  }
};

/**
 * Get pending grant reviews for DRD reviewers
 */
exports.getPendingGrantReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, schoolId } = req.query;

    // Get user's DRD permissions and assigned schools
    let userDrdPermission = null;
    try {
      const drdDept = await prisma.centralDepartment.findFirst({
        where: {
          OR: [
            { departmentCode: 'DRD' },
            { departmentCode: 'drd' },
            { shortName: 'DRD' }
          ]
        }
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
            assignedGrantSchoolIds: true
          }
        });
      }
    } catch (permError) {
      console.log('Note: Error fetching DRD permissions:', permError.message);
    }

    const permissions = userDrdPermission?.permissions || {};
    // Filter out null/undefined values from assignedSchoolIds to prevent Prisma errors
    const assignedSchoolIds = (userDrdPermission?.assignedGrantSchoolIds || []).filter(id => id !== null && id !== undefined);

    // Check grant permissions
    const hasGrantApprove = permissions.grant_approve === true;
    const hasGrantReview = permissions.grant_review === true;

    console.log(`User ${userId} DRD grant permissions:`, {
      hasReviewPerm: hasGrantReview,
      hasApprovePerm: hasGrantApprove,
      assignedGrantSchoolIds: assignedSchoolIds,
      permissions
    });

    if (!hasGrantApprove && !hasGrantReview) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - No grant review or approve permissions'
      });
    }

    // Build where clause for grants based on permission type
    let whereClause = {};

    if (hasGrantApprove && !hasGrantReview) {
      // ONLY approve permission: Show recommended grants
      const pendingStatuses = ['recommended'];
      
      // Prepare school filter conditions
      const schoolOrConditions = [];
      
      // Add assigned schools
      if (assignedSchoolIds && assignedSchoolIds.length > 0) {
        schoolOrConditions.push({ schoolId: { in: assignedSchoolIds } });
      }
      
      if (schoolOrConditions.length > 0) {
        whereClause = {
          AND: [
            {
              status: {
                in: status ? [status] : [...pendingStatuses, 'approved']
              }
            },
            {
              OR: schoolOrConditions
            }
          ]
        };
      } else {
        // No assigned schools - show all recommended and approved
        whereClause = {
          status: {
            in: status ? [status] : [...pendingStatuses, 'approved']
          }
        };
      }
    } else if (hasGrantReview && !hasGrantApprove) {
      // ONLY review permission: Show grants in review stages
      const pendingStatuses = ['submitted', 'under_review', 'changes_required', 'resubmitted'];
      
      // Prepare school filter conditions
      const schoolOrConditions = [];
      
      // Add assigned schools
      if (assignedSchoolIds && assignedSchoolIds.length > 0) {
        schoolOrConditions.push({ schoolId: { in: assignedSchoolIds } });
      }
      
      if (schoolOrConditions.length > 0) {
        whereClause = {
          AND: [
            {
              status: {
                in: status ? [status] : pendingStatuses
              }
            },
            {
              OR: schoolOrConditions
            }
          ]
        };
      } else {
        // No assigned schools - show all in review
        whereClause = {
          status: {
            in: status ? [status] : pendingStatuses
          }
        };
      }
    } else {
      // BOTH permissions: Show all stages
      const pendingStatuses = ['submitted', 'under_review', 'changes_required', 'resubmitted', 'recommended'];
      
      // Prepare school filter conditions
      const schoolOrConditions = [];
      
      // Add assigned schools
      if (assignedSchoolIds && assignedSchoolIds.length > 0) {
        schoolOrConditions.push({ schoolId: { in: assignedSchoolIds } });
      }
      
      if (schoolOrConditions.length > 0) {
        whereClause = {
          AND: [
            {
              status: {
                in: status ? [status] : [...pendingStatuses, 'approved']
              }
            },
            {
              OR: schoolOrConditions
            }
          ]
        };
      } else {
        // No assigned schools - show all
        whereClause = {
          status: {
            in: status ? [status] : [...pendingStatuses, 'approved']
          }
        };
      }
    }

    // Add school filter
    if (schoolId) {
      if (whereClause.AND) {
        whereClause.AND.push({ schoolId });
      } else {
        whereClause.schoolId = schoolId;
      }
    }

    const grants = await prisma.grantApplication.findMany({
      where: whereClause,
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
                displayName: true,
                designation: true
              }
            }
          }
        },
        school: {
          select: {
            id: true,
            facultyName: true,
            facultyCode: true,
            shortName: true
          }
        },
        department: {
          select: {
            id: true,
            departmentName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform grants to match research contribution structure
    const transformedGrants = grants.map(grant => ({
      id: grant.id,
      applicationNumber: grant.applicationNumber,
      title: grant.title,
      publicationType: 'grant_proposal',
      status: grant.status,
      applicantUserId: grant.applicantUserId,
      schoolId: grant.schoolId,
      departmentId: grant.departmentId,
      submittedAt: grant.submittedAt,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      calculatedIncentiveAmount: grant.calculatedIncentiveAmount,
      calculatedPoints: grant.calculatedPoints,
      applicantUser: grant.applicantUser,
      school: grant.school,
      department: grant.department,
      reviews: [], // Grants don't have reviews in the same structure yet
      awaitingFinalApproval: false,
      isRecommended: false
    }));

    // Get statistics
    const stats = {
      submitted: grants.filter(g => g.status === 'submitted').length,
      underReview: grants.filter(g => g.status === 'under_review').length,
      changesRequired: grants.filter(g => g.status === 'changes_required').length,
      resubmitted: grants.filter(g => g.status === 'resubmitted').length,
      recommended: grants.filter(g => g.status === 'recommended').length,
      approved: grants.filter(g => g.status === 'approved').length,
      total: grants.length
    };

    console.log(`Found ${grants.length} grants for user ${userId}`);
    console.log('Grant IDs:', grants.map(g => ({ id: g.id, title: g.title, status: g.status, schoolId: g.schoolId })));
    console.log('Transformed grants:', transformedGrants.length);

    // Add cache control headers to prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.status(200).json({
      success: true,
      data: {
        contributions: transformedGrants, // Use same key as research contributions
        stats,
        userPermissions: {
          hasApprovePermission: hasGrantApprove,
          hasReviewPermission: hasGrantReview,
          assignedSchoolIds,
          canReview: hasGrantReview,
          canApprove: hasGrantApprove,
          hasGrantReview,
          hasGrantApprove
        }
      }
    });
  } catch (error) {
    console.error('Get pending grant reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending grant reviews',
      error: error.message
    });
  }
};

/**
 * Get all pending reviews (both research contributions and grants combined)
 */
exports.getAllPendingReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, schoolId } = req.query;

    // Fetch research contributions (use 'research_paper' to avoid infinite recursion)
    const researchReq = { ...req, query: { ...req.query, publicationType: 'research_paper' } };
    const grantReq = { ...req, query: { ...req.query, publicationType: 'grant_proposal' } };

    // Get contributions and grants in parallel
    const [researchResponse, grantResponse] = await Promise.all([
      new Promise((resolve) => {
        exports.getPendingReviews(researchReq, {
          set: () => ({}),  // Mock set() method for cache headers
          status: (code) => ({ json: (data) => resolve({ code, data }) })
        });
      }),
      new Promise((resolve) => {
        exports.getPendingGrantReviews(grantReq, {
          set: () => ({}),  // Mock set() method for cache headers
          status: (code) => ({ json: (data) => resolve({ code, data }) })
        });
      })
    ]);

    // Combine the results
    const researchContributions = researchResponse.data?.data?.contributions || [];
    const grants = grantResponse.data?.data?.contributions || [];
    const allContributions = [...researchContributions, ...grants];

    // Combine stats
    const combinedStats = {
      submitted: (researchResponse.data?.data?.stats?.submitted || 0) + (grantResponse.data?.data?.stats?.submitted || 0),
      underReview: (researchResponse.data?.data?.stats?.underReview || 0) + (grantResponse.data?.data?.stats?.underReview || 0),
      changesRequired: (researchResponse.data?.data?.stats?.changesRequired || 0) + (grantResponse.data?.data?.stats?.changesRequired || 0),
      resubmitted: (researchResponse.data?.data?.stats?.resubmitted || 0) + (grantResponse.data?.data?.stats?.resubmitted || 0),
      approved: (researchResponse.data?.data?.stats?.approved || 0) + (grantResponse.data?.data?.stats?.approved || 0),
      total: allContributions.length
    };

    console.log(`Combined: ${researchContributions.length} research + ${grants.length} grants = ${allContributions.length} total`);

    res.status(200).json({
      success: true,
      data: {
        contributions: allContributions,
        stats: combinedStats,
        userPermissions: researchResponse.data?.data?.userPermissions || {}
      }
    });
  } catch (error) {
    console.error('Get all pending reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get all pending reviews',
      error: error.message
    });
  }
};

/**
 * Start review - move to under_review status
 * Handles both research contributions and grants
 */
exports.startReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Try to find as research contribution first
    let contribution = await prisma.researchContribution.findUnique({
      where: { id }
    });

    let isGrant = false;

    // If not found, try as grant
    if (!contribution) {
      contribution = await prisma.grantApplication.findUnique({
        where: { id }
      });
      isGrant = true;
    }

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Research contribution or grant not found'
      });
    }

    if (!['submitted', 'resubmitted'].includes(contribution.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot start review for ${isGrant ? 'grant' : 'contribution'} in status: ${contribution.status}`
      });
    }

    // Update the appropriate table
    if (isGrant) {
      const updated = await prisma.grantApplication.update({
        where: { id },
        data: {
          status: 'under_review',
          currentReviewerId: userId
        }
      });

      // Create status history for grant
      await prisma.grantApplicationStatusHistory.create({
        data: {
          grantApplicationId: id,
          fromStatus: contribution.status,
          toStatus: 'under_review',
          changedById: userId,
          comments: 'Review started'
        }
      });

      res.status(200).json({
        success: true,
        message: 'Grant review started',
        data: updated
      });
    } else {
      const updated = await prisma.researchContribution.update({
        where: { id },
        data: {
          status: 'under_review',
          currentReviewerId: userId
        }
      });

      await prisma.researchContributionStatusHistory.create({
        data: {
          researchContributionId: id,
          fromStatus: contribution.status,
          toStatus: 'under_review',
          changedById: userId,
          comments: 'Review started'
        }
      });

      res.status(200).json({
        success: true,
        message: 'Review started',
        data: updated
      });
    }
  } catch (error) {
    console.error('Start review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start review',
      error: error.message
    });
  }
};

/**
 * Request changes from applicant
 */
exports.requestChanges = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { comments, suggestions } = req.body;

    const contribution = await prisma.researchContribution.findUnique({
      where: { id }
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Research contribution not found'
      });
    }

    if (!['submitted', 'under_review', 'resubmitted'].includes(contribution.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot request changes for contribution in status: ${contribution.status}`
      });
    }

    // Create review record
    await prisma.researchContributionReview.create({
      data: {
        researchContributionId: id,
        reviewerId: userId,
        reviewerRole: 'drd_reviewer',
        comments,
        decision: 'changes_required',
        hasSuggestions: suggestions && suggestions.length > 0,
        suggestionsCount: suggestions?.length || 0,
        pendingSuggestionsCount: suggestions?.length || 0,
        reviewedAt: new Date()
      }
    });

    // Create edit suggestions if provided
    if (suggestions && suggestions.length > 0) {
      for (const suggestion of suggestions) {
        await prisma.researchContributionEditSuggestion.create({
          data: {
            researchContributionId: id,
            reviewerId: userId,
            fieldName: suggestion.fieldName,
            fieldPath: suggestion.fieldPath,
            originalValue: suggestion.originalValue,
            suggestedValue: suggestion.suggestedValue,
            suggestionNote: suggestion.note,
            status: 'pending'
          }
        });
      }
    }

    // Update status
    const updated = await prisma.researchContribution.update({
      where: { id },
      data: {
        status: 'changes_required'
      }
    });

    // Create status history
    await prisma.researchContributionStatusHistory.create({
      data: {
        researchContributionId: id,
        fromStatus: contribution.status,
        toStatus: 'changes_required',
        changedById: userId,
        comments: comments || 'Changes requested by DRD reviewer'
      }
    });

    // Notify applicant
    if (contribution.applicantUserId) {
      const publicationTypeLabel = {
        'research_paper': 'Research Paper',
        'book': 'Book',
        'book_chapter': 'Book Chapter',
        'conference_paper': 'Conference Paper',
        'grant': 'Grant'
      }[contribution.publicationType] || 'Publication';
      
      await prisma.notification.create({
        data: {
          userId: contribution.applicantUserId,
          type: 'research_changes_required',
          title: 'Changes Requested',
          message: `Your ${publicationTypeLabel.toLowerCase()} "${contribution.title}" requires changes. Please review the feedback and resubmit.`,
          referenceType: 'research_contribution',
          referenceId: id,
          metadata: {
            publicationType: contribution.publicationType
          }
        }
      });
    }

    res.status(200).json({
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

/**
 * Recommend contribution for approval (Reviewer with research_review permission)
 * Updates status to indicate it's ready for final approval
 */
exports.recommendForApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { comments } = req.body;

    const contribution = await prisma.researchContribution.findUnique({
      where: { id },
      include: {
        applicantUser: true
      }
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Research contribution not found'
      });
    }

    if (!['submitted', 'under_review', 'resubmitted'].includes(contribution.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot recommend contribution in status: ${contribution.status}`
      });
    }

    // Update status to recommended (uses under_review with a review entry)
    const updated = await prisma.researchContribution.update({
      where: { id },
      data: {
        status: 'under_review',
        currentReviewerId: userId,
        reviews: {
          create: {
            reviewerId: userId,
            reviewerRole: req.user.role || 'reviewer',
            decision: 'recommended',
            comments: comments || 'Recommended for final approval',
            reviewedAt: new Date()
          }
        },
        statusHistory: {
          create: {
            fromStatus: contribution.status,
            toStatus: 'under_review',
            changedById: userId,
            comments: comments || 'Recommended for final approval by reviewer',
            metadata: {
              action: 'recommended_for_approval',
              decision: 'recommended'
            }
          }
        }
      },
      include: {
        authors: true,
        applicantUser: true,
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
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true
                  }
                }
              }
            }
          },
          orderBy: { changedAt: 'desc' }
        }
      }
    });

    // Create notification for approvers
    try {
      // Get users with research_approve permission
      const approvers = await prisma.centralDepartmentMember.findMany({
        where: {
          centralDepartmentId: contribution.assignedDeptId,
          permissions: {
            path: ['research_approve'],
            equals: true
          }
        },
        include: {
          employee: true
        }
      });

      for (const approver of approvers) {
        const publicationTypeLabel = {
          'research_paper': 'Research Paper',
          'book': 'Book',
          'book_chapter': 'Book Chapter',
          'conference_paper': 'Conference Paper',
          'grant': 'Grant'
        }[contribution.publicationType] || 'Publication';
        
        await prisma.notification.create({
          data: {
            userId: approver.employeeId,
            type: 'research_recommended',
            title: `${publicationTypeLabel} Recommended for Approval`,
            message: `${updated.title} has been recommended for your approval by a reviewer.`,
            referenceType: 'research_contribution',
            referenceId: id,
            metadata: {
              publicationType: contribution.publicationType
            }
          }
        });
      }
    } catch (notifError) {
      console.error('Failed to send notifications:', notifError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Contribution recommended for approval successfully',
      data: updated
    });
  } catch (error) {
    console.error('Recommend for approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recommend contribution',
      error: error.message
    });
  }
};

/**
 * Approve research contribution (DRD Head only)
 * Credits incentives to all authors based on their roles
 */
exports.approveContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { comments } = req.body;

    const contribution = await prisma.researchContribution.findUnique({
      where: { id },
      include: {
        authors: true,
        applicantUser: true
      }
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Research contribution not found'
      });
    }

    if (!['submitted', 'under_review', 'resubmitted'].includes(contribution.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve contribution in status: ${contribution.status}`
      });
    }

    // Count internal vs external authors for proper distribution
    const totalAuthors = contribution.authors.length;
    const internalAuthors = contribution.authors.filter(a => {
      const category = a.authorCategory?.toLowerCase() || 'internal';
      return !category.includes('external');
    });
    
    const internalCoAuthors = internalAuthors.filter(a => {
      const role = a.authorType || 'co_author'; // Fixed: authorType not authorRole
      return role === 'co_author' || role === 'senior_author';
    });
    
    const internalEmployeeCoAuthors = internalCoAuthors.filter(a => {
      const type = a.authorType?.toLowerCase() || '';
      return !type.includes('student');
    });

    const totalCoAuthors = contribution.authors.filter(a => {
      const role = a.authorType || 'co_author'; // Fixed: authorType not authorRole
      return role === 'co_author' || role === 'senior_author';
    }).length;

    // Fetch active policy to get correct percentages (no hardcoding!)
    const activePolicy = await prisma.researchIncentivePolicy.findFirst({
      where: { publicationType: 'research_paper', isActive: true },
      select: { first_author_percentage: true, corresponding_author_percentage: true }
    });
    
    if (!activePolicy) {
      return res.status(500).json({
        success: false,
        message: 'No active research policy found. Please configure policy in admin panel.'
      });
    }
    
    const policyFirstPct = Number(activePolicy.first_author_percentage);
    const policyCorrespondingPct = Number(activePolicy.corresponding_author_percentage);
    
    // Check if first/corresponding are external (to track lost percentage)
    // Use actual policy percentages, not hardcoded values
    let externalFirstCorrespondingPct = 0;
    contribution.authors.forEach(a => {
      const isExternal = a.authorCategory?.toLowerCase().includes('external');
      if (isExternal) {
        const role = a.authorType || 'co_author';
        if (role === 'first_author') externalFirstCorrespondingPct += policyFirstPct;
        if (role === 'corresponding_author') externalFirstCorrespondingPct += policyCorrespondingPct;
        if (role === 'first_and_corresponding_author' || role === 'first_and_corresponding') {
          externalFirstCorrespondingPct += (policyFirstPct + policyCorrespondingPct);
        }
      }
    });

    const now = new Date();
    let totalIncentiveAwarded = 0;
    let totalPointsAwarded = 0;

    // Use the existing calculateIncentives function from contribution.controller
    const { calculateIncentives } = require('./contribution.controller');

    for (const author of contribution.authors) {
      const isExternal = author.authorCategory?.toLowerCase().includes('external');
      const authorRole = author.authorType || 'co_author'; // Fixed: authorType not authorRole
      const isStudent = author.authorType?.toLowerCase().includes('student') || false;

      console.log('[Approval] Calculating for author:', {
        authorId: author.id,
        authorName: author.authorName,
        authorRole,
        isStudent,
        isExternal,
        publicationType: contribution.publicationType
      });

      // Calculate incentive using the same function as submission
      const incentiveResult = await calculateIncentives(
        contribution,                          // contributionData
        contribution.publicationType,         // publicationType
        authorRole,                           // authorRole
        isStudent,                            // isStudent
        contribution.sjr || 0,                // sjrValue
        totalCoAuthors,                       // coAuthorCount
        totalAuthors,                         // totalAuthors
        !isExternal,                          // isInternal
        internalCoAuthors.length,            // internalCoAuthorCount
        externalFirstCorrespondingPct,       // externalFirstCorrespondingPct
        internalEmployeeCoAuthors.length     // internalEmployeeCoAuthorCount
      );

      const authorIncentive = incentiveResult.incentiveAmount || 0;
      const authorPoints = incentiveResult.points || 0;

      // Update author with calculated incentive
      await prisma.researchContributionAuthor.update({
        where: { id: author.id },
        data: {
          incentiveShare: Math.round(authorIncentive),
          pointsShare: authorPoints
        }
      });

      totalIncentiveAwarded += Math.round(authorIncentive);
      totalPointsAwarded += authorPoints;

      if (author.userId && !isExternal) {
        // Create notification ONLY for internal authors
        const publicationTypeLabel = {
          'research_paper': 'Research Paper',
          'book': 'Book',
          'book_chapter': 'Book Chapter',
          'conference_paper': 'Conference Paper',
          'grant': 'Grant'
        }[contribution.publicationType] || 'Publication';
        
        await prisma.notification.create({
          data: {
            userId: author.userId,
            type: 'research_incentive_credited',
            title: `${publicationTypeLabel} Incentive Credited`,
            message: `You have been credited ₹${Math.round(authorIncentive).toLocaleString()} and ${authorPoints} points for "${contribution.title}" as ${authorRole.replace(/_/g, ' ')}.`,
            referenceType: 'research_contribution',
            referenceId: id,
            metadata: {
              incentiveAmount: Math.round(authorIncentive),
              points: authorPoints,
              authorRole: authorRole,
              publicationType: contribution.publicationType,
              yourShare: Math.round(authorIncentive),
              yourPoints: authorPoints
            }
          }
        });
      }
    }

    // Notify applicant
    if (contribution.applicantUserId) {
      const publicationTypeLabel = {
        'research_paper': 'Research Paper',
        'book': 'Book',
        'book_chapter': 'Book Chapter',
        'conference_paper': 'Conference Paper',
        'grant': 'Grant'
      }[contribution.publicationType] || 'Publication';
      
      await prisma.notification.create({
        data: {
          userId: contribution.applicantUserId,
          type: 'research_approved',
          title: `${publicationTypeLabel} Approved`,
          message: `Your ${publicationTypeLabel.toLowerCase()} "${contribution.title}" has been approved. Total incentives credited: ₹${totalIncentiveAwarded.toLocaleString()} and ${totalPointsAwarded} points distributed among all internal authors as per policy.`,
          referenceType: 'research_contribution',
          referenceId: id,
          metadata: {
            incentiveAmount: totalIncentiveAwarded,
            points: totalPointsAwarded,
            publicationType: contribution.publicationType
          }
        }
      });
    }

    // Notify reviewers who recommended this contribution
    const recommendingReviews = await prisma.researchContributionReview.findMany({
      where: {
        researchContributionId: id,
        decision: 'recommended'
      },
      include: {
        reviewer: true
      }
    });

    for (const review of recommendingReviews) {
      const publicationTypeLabel = {
        'research_paper': 'Research Paper',
        'book': 'Book',
        'book_chapter': 'Book Chapter',
        'conference_paper': 'Conference Paper',
        'grant': 'Grant'
      }[contribution.publicationType] || 'Publication';
      
      await prisma.notification.create({
        data: {
          userId: review.reviewerId,
          type: 'research_recommendation_approved',
          title: 'Your Recommendation Approved',
          message: `Your recommended ${publicationTypeLabel.toLowerCase()} "${contribution.title}" has been approved by the approver.`,
          referenceType: 'research_contribution',
          referenceId: id,
          metadata: {
            reviewId: review.id,
            approvedAt: now.toISOString(),
            publicationType: contribution.publicationType
          }
        }
      });
    }

    // Create review record
    await prisma.researchContributionReview.create({
      data: {
        researchContributionId: id,
        reviewerId: userId,
        reviewerRole: 'drd_head',
        comments,
        decision: 'approved',
        reviewedAt: now
      }
    });

    // Update contribution status and credit incentives
    const updated = await prisma.researchContribution.update({
      where: { id },
      data: {
        status: 'approved',
        incentiveAmount: totalIncentiveAwarded,
        pointsAwarded: totalPointsAwarded,
        creditedAt: now,
        completedAt: now
      }
    });

    // Create status history
    await prisma.researchContributionStatusHistory.create({
      data: {
        researchContributionId: id,
        fromStatus: contribution.status,
        toStatus: 'approved',
        changedById: userId,
        comments: comments || 'Approved by DRD Head - Incentives credited based on author roles'
      }
    });

    // === COMPREHENSIVE AUDIT LOGGING ===
    await logResearchStatusChange(
      updated,
      contribution.status,
      'approved',
      userId,
      req,
      comments || 'Approved by DRD Head - Incentives credited based on author roles'
    );
    // === END AUDIT LOGGING ===

    res.status(200).json({
      success: true,
      message: 'Research contribution approved and incentives credited based on author roles',
      data: {
        ...updated,
        incentiveBreakdown: {
          totalIncentiveAwarded,
          totalPointsAwarded,
          authorCount: contribution.authors.length,
          policyUsed: 'Calculated via calculateIncentives function',
          distributionMethod: 'percentage-based',
          firstAuthorPercent: policyFirstPct,
          correspondingAuthorPercent: policyCorrespondingPct,
          coAuthorPercent: (totalCoAuthors > 0 ? Math.round(((100 - policyFirstPct - policyCorrespondingPct) / totalCoAuthors) * 100) / 100 : 0)
        }
      }
    });
  } catch (error) {
    console.error('Approve contribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve contribution',
      error: error.message
    });
  }
};

/**
 * Reject research contribution
 */
exports.rejectContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { comments, reason } = req.body;

    const contribution = await prisma.researchContribution.findUnique({
      where: { id }
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Research contribution not found'
      });
    }

    // Create review record
    await prisma.researchContributionReview.create({
      data: {
        researchContributionId: id,
        reviewerId: userId,
        reviewerRole: 'drd_head',
        comments: comments || reason,
        decision: 'rejected',
        reviewedAt: new Date()
      }
    });

    // Update status
    const updated = await prisma.researchContribution.update({
      where: { id },
      data: {
        status: 'rejected'
      }
    });

    // Create status history
    await prisma.researchContributionStatusHistory.create({
      data: {
        researchContributionId: id,
        fromStatus: contribution.status,
        toStatus: 'rejected',
        changedById: userId,
        comments: comments || reason || 'Rejected by DRD'
      }
    });

    // Notify applicant
    if (contribution.applicantUserId) {
      const publicationTypeLabel = {
        'research_paper': 'Research Paper',
        'book': 'Book',
        'book_chapter': 'Book Chapter',
        'conference_paper': 'Conference Paper',
        'grant': 'Grant'
      }[contribution.publicationType] || 'Publication';
      
      await prisma.notification.create({
        data: {
          userId: contribution.applicantUserId,
          type: 'research_rejected',
          title: `${publicationTypeLabel} Rejected`,
          message: `Your ${publicationTypeLabel.toLowerCase()} "${contribution.title}" has been rejected. Reason: ${reason || comments || 'Not specified'}`,
          referenceType: 'research_contribution',
          referenceId: id,
          metadata: {
            publicationType: contribution.publicationType
          }
        }
      });
    }

    // === COMPREHENSIVE AUDIT LOGGING ===
    await logResearchStatusChange(
      updated,
      contribution.status,
      'rejected',
      userId,
      req,
      comments || reason || 'Rejected by DRD'
    );
    // === END AUDIT LOGGING ===

    res.status(200).json({
      success: true,
      message: 'Research contribution rejected',
      data: updated
    });
  } catch (error) {
    console.error('Reject contribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject contribution',
      error: error.message
    });
  }
};

/**
 * Mark as completed (after approval)
 */
exports.markCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const contribution = await prisma.researchContribution.findUnique({
      where: { id }
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Research contribution not found'
      });
    }

    if (contribution.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Can only mark approved contributions as completed'
      });
    }

    const updated = await prisma.researchContribution.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    await prisma.researchContributionStatusHistory.create({
      data: {
        researchContributionId: id,
        fromStatus: 'approved',
        toStatus: 'completed',
        changedById: userId,
        comments: 'Process completed'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Research contribution marked as completed',
      data: updated
    });
  } catch (error) {
    console.error('Mark completed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as completed',
      error: error.message
    });
  }
};

/**
 * Get review statistics
 */
exports.getReviewStatistics = async (req, res) => {
  try {
    const { schoolId, publicationType, startDate, endDate } = req.query;

    const whereClause = {};

    if (schoolId) {
      whereClause.schoolId = schoolId;
    }

    if (publicationType) {
      whereClause.publicationType = publicationType;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate);
      }
    }

    // Count by status
    const statusCounts = await prisma.researchContribution.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true
      }
    });

    // Count by publication type
    const typeCounts = await prisma.researchContribution.groupBy({
      by: ['publicationType'],
      where: whereClause,
      _count: {
        id: true
      }
    });

    // Total incentives and points
    const totals = await prisma.researchContribution.aggregate({
      where: {
        ...whereClause,
        status: { in: ['approved', 'completed'] }
      },
      _sum: {
        incentiveAmount: true,
        pointsAwarded: true
      },
      _count: {
        id: true
      }
    });

    // By school
    const schoolCounts = await prisma.researchContribution.groupBy({
      by: ['schoolId'],
      where: whereClause,
      _count: {
        id: true
      }
    });

    res.status(200).json({
      success: true,
      data: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {}),
        byPublicationType: typeCounts.reduce((acc, item) => {
          acc[item.publicationType] = item._count.id;
          return acc;
        }, {}),
        totals: {
          approved: totals._count.id,
          totalIncentives: totals._sum.incentiveAmount || 0,
          totalPoints: totals._sum.pointsAwarded || 0
        },
        bySchool: schoolCounts
      }
    });
  } catch (error) {
    console.error('Get review statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: error.message
    });
  }
};

/**
 * Respond to edit suggestion (by applicant)
 */
exports.respondToSuggestion = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const userId = req.user.id;
    const { accept, response } = req.body;

    const suggestion = await prisma.researchContributionEditSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        researchContribution: true
      }
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    if (suggestion.researchContribution.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the applicant can respond to suggestions'
      });
    }

    // Update suggestion
    await prisma.researchContributionEditSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: accept ? 'accepted' : 'rejected',
        applicantResponse: response,
        respondedAt: new Date()
      }
    });

    // If accepted, apply the change
    if (accept && suggestion.fieldName && suggestion.suggestedValue) {
      const updateData = {};
      let valueToUpdate = suggestion.suggestedValue;
      
      // Handle sdg_goals - convert string to array
      if (suggestion.fieldName === 'sdg_goals') {
        valueToUpdate = typeof suggestion.suggestedValue === 'string'
          ? suggestion.suggestedValue.split(',').map(s => s.trim()).filter(s => s)
          : suggestion.suggestedValue;
      }
      // Handle integer fields
      else if (['totalPresenters', 'foreignCollaborationsCount'].includes(suggestion.fieldName)) {
        valueToUpdate = suggestion.suggestedValue ? parseInt(suggestion.suggestedValue, 10) : null;
      }
      // Handle boolean fields that come as "yes"/"no" strings
      else if ([
        'communicatedWithOfficialId', 
        'interdisciplinaryFromSgt', 
        'studentsFromSgt', 
        'internationalAuthor',
        'conferenceHeldAtSgt',
        'virtualConference',
        'industryCollaboration',
        'centralFacilityUsed',
        'conferenceBestPaperAward'
      ].includes(suggestion.fieldName)) {
        if (typeof suggestion.suggestedValue === 'string') {
          const lowerValue = suggestion.suggestedValue.toLowerCase();
          valueToUpdate = lowerValue === 'yes' || lowerValue === 'true';
        } else {
          valueToUpdate = Boolean(suggestion.suggestedValue);
        }
      }
      // targetedResearchType field has been removed - now using indexingCategories array
      // If this suggestion comes through, ignore it as the field no longer exists
      else if (suggestion.fieldName === 'targetedResearchType') {
        console.warn('[applyEditSuggestions] Ignoring suggestion for obsolete field: targetedResearchType');
        // Don't apply this change, just mark suggestion as accepted
        // The actual update will be skipped by not adding it to updateData
        valueToUpdate = null;
      }
      // Handle quartile - convert display value to enum value
      else if (suggestion.fieldName === 'quartile') {
        const displayToEnumMap = {
          'Top 1%': 'Top_1_',
          'Top 5%': 'Top_5_',
          'Q1': 'Q1',
          'Q2': 'Q2',
          'Q3': 'Q3',
          'Q4': 'Q4',
          'top1': 'Top_1_',
          'top5': 'Top_5_',
          'q1': 'Q1',
          'q2': 'Q2',
          'q3': 'Q3',
          'q4': 'Q4'
        };
        valueToUpdate = displayToEnumMap[suggestion.suggestedValue] || suggestion.suggestedValue;
      }
      
      // Only apply the update if the field is not obsolete
      if (suggestion.fieldName !== 'targetedResearchType') {
        updateData[suggestion.fieldName] = valueToUpdate;
        
        await prisma.researchContribution.update({
          where: { id: suggestion.researchContributionId },
          data: updateData
        });
      }
    }

    // Update pending suggestions count in review
    const pendingCount = await prisma.researchContributionEditSuggestion.count({
      where: {
        researchContributionId: suggestion.researchContributionId,
        status: 'pending'
      }
    });

    // Update the latest review record
    await prisma.researchContributionReview.updateMany({
      where: {
        researchContributionId: suggestion.researchContributionId
      },
      data: {
        pendingSuggestionsCount: pendingCount
      }
    });

    res.status(200).json({
      success: true,
      message: `Suggestion ${accept ? 'accepted' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Respond to suggestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to suggestion',
      error: error.message
    });
  }
};

/**
 * Get all schools for filtering
 */
exports.getSchoolsForFilter = async (req, res) => {
  try {
    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true
      },
      orderBy: { facultyName: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: schools
    });
  } catch (error) {
    console.error('Get schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get schools',
      error: error.message
    });
  }
};

module.exports = exports;
