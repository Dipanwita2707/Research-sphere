/**
 * Grant Application Controller
 * Handles all CRUD operations for research grant applications
 */

const prisma = require('../../../shared/config/database');
const { logResearchFiling, logResearchUpdate, logResearchStatusChange, logFileUpload, getIp } = require('../../../shared/utils/auditLogger');
const { uploadToS3 } = require('../../../shared/utils/s3');

/**
 * Generate unique application number for grants
 */
const generateApplicationNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `GRT-${year}`;
  
  const lastGrant = await prisma.grantApplication.findFirst({
    where: {
      applicationNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      applicationNumber: 'desc'
    }
  });
  
  let nextNumber = 1;
  if (lastGrant && lastGrant.applicationNumber) {
    const lastNumber = parseInt(lastGrant.applicationNumber.split('-').pop() || '0');
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
};

/**
 * Create a new grant application
 */
exports.createGrantApplication = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Parse data from either JSON or FormData (if file upload)
    let requestData = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
      try {
        requestData = JSON.parse(req.body.data);
        console.log('Parsed FormData JSON successfully');
      } catch (parseError) {
        console.error('Error parsing FormData JSON:', parseError);
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid data format' 
        });
      }
    }

    console.log('Request data keys:', Object.keys(requestData));
    console.log('Title value:', requestData.title);
    console.log('File uploaded:', req.file ? req.file.filename : 'No file');

    const {
      title,
      submittedAmount,
      sdgGoals,
      projectType,
      numberOfConsortiumOrgs,
      projectStatus,
      projectCategory,
      fundingAgencyType,
      fundingAgencyName,
      totalInvestigators,
      numberOfInternalPIs,
      numberOfInternalCoPIs,
      isPIExternal,
      myRole,
      dateOfSubmission,
      projectStartDate,
      projectEndDate,
      projectDurationMonths,
      schoolId,
      departmentId,
      status,
      consortiumOrganizations,
      investigators
    } = requestData;
    
    // Validate required field: title
    if (!title || !title.trim()) {
      console.error('Title validation failed. Title value:', title);
      return res.status(400).json({ 
        success: false, 
        message: 'Title is required' 
      });
    }

    // Always create as draft first, then submit if requested
    // This ensures proper workflow tracking
    const createStatus = 'draft';
    const shouldSubmitImmediately = status === 'submitted';

    // Determine applicant type from user role
    const userLogin = await prisma.userLogin.findUnique({
      where: { id: userId },
      include: { employeeDetails: true, studentLogin: true }
    });

    let applicantType = 'internal_faculty';
    if (userLogin?.role === 'student') {
      applicantType = 'internal_student';
    } else if (userLogin?.role === 'staff') {
      applicantType = 'internal_staff';
    }

    // Handle file upload - upload to S3
    let proposalFilePath = null;
    if (req.file) {
      const s3Result = await uploadToS3(
        req.file.buffer,
        'research/grants',
        userId.toString(),
        req.file.originalname,
        req.file.mimetype
      );
      proposalFilePath = s3Result.key;
    }

    // Create grant application with nested relations
    const grantApplication = await prisma.grantApplication.create({
      data: {
        applicationNumber: null, // Will be generated on submission
        applicantUserId: userId,
        applicantType,
        title,
        submittedAmount: submittedAmount ? parseFloat(submittedAmount) : null,
        sdgGoals: sdgGoals || [],
        projectType: projectType || 'indian',
        numberOfConsortiumOrgs: numberOfConsortiumOrgs || 0,
        projectStatus: projectStatus || 'submitted',
        projectCategory: projectCategory || 'govt',
        fundingAgencyType: fundingAgencyType || null,
        fundingAgencyName: fundingAgencyName || null,
        totalInvestigators: totalInvestigators || 1,
        numberOfInternalPIs: numberOfInternalPIs || 1,
        numberOfInternalCoPIs: numberOfInternalCoPIs || 0,
        isPIExternal: isPIExternal || false,
        myRole: myRole || 'pi',
        dateOfSubmission: dateOfSubmission ? new Date(dateOfSubmission) : null,
        projectStartDate: projectStartDate ? new Date(projectStartDate) : null,
        projectEndDate: projectEndDate ? new Date(projectEndDate) : null,
        projectDurationMonths: projectDurationMonths ? parseInt(projectDurationMonths) : null,
        schoolId: schoolId || null,
        departmentId: departmentId || null,
        status: createStatus,
        submittedAt: null,
        proposalFilePath: proposalFilePath,
        // Create consortium organizations
        consortiumOrganizations: projectType === 'international' && consortiumOrganizations?.length > 0 ? {
          create: consortiumOrganizations.map((org, index) => ({
            organizationName: org.organizationName,
            country: org.country,
            numberOfMembers: org.numberOfMembers || 1,
            displayOrder: index
          }))
        } : undefined
      },
      include: {
        consortiumOrganizations: true,
        school: true,
        department: true
      }
    });

    // Add investigators if provided
    if (investigators && investigators.length > 0) {
      // First, get the created consortium org IDs
      const orgIdMap = {};
      if (grantApplication.consortiumOrganizations) {
        consortiumOrganizations?.forEach((inputOrg, index) => {
          const createdOrg = grantApplication.consortiumOrganizations[index];
          if (createdOrg) {
            orgIdMap[inputOrg.id] = createdOrg.id;
          }
        });
      }

      // Create investigators
      for (const inv of investigators) {
        await prisma.grantInvestigator.create({
          data: {
            grantApplicationId: grantApplication.id,
            userId: inv.userId || null,
            uid: inv.uid || null,
            name: inv.name,
            email: inv.email || null,
            phone: inv.phone || null,
            designation: inv.designation || null,
            affiliation: inv.affiliation || null,
            department: inv.department || null,
            roleType: inv.roleType || 'co_pi',
            isInternal: inv.isInternal !== false,
            investigatorType: inv.investigatorType || 'Faculty',
            consortiumOrgId: inv.consortiumOrgId ? orgIdMap[inv.consortiumOrgId] : null,
            isTeamCoordinator: inv.isTeamCoordinator || false,
            displayOrder: inv.displayOrder || 0
          }
        });
      }
    }

    // Create status history entry
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: grantApplication.id,
        fromStatus: null,
        toStatus: createStatus,
        changedById: userId,
        comments: 'Draft created'
      }
    });

    // If user wants to submit immediately, do that now
    let finalGrant = grantApplication;
    if (shouldSubmitImmediately) {
      // Generate application number
      const applicationNumber = await generateApplicationNumber();
      
      // Update to submitted status
      finalGrant = await prisma.grantApplication.update({
        where: { id: grantApplication.id },
        data: {
          applicationNumber,
          status: 'submitted',
          submittedAt: new Date()
        }
      });

      // Create submission status history
      await prisma.grantApplicationStatusHistory.create({
        data: {
          grantApplicationId: grantApplication.id,
          fromStatus: 'draft',
          toStatus: 'submitted',
          changedById: userId,
          comments: 'Application submitted'
        }
      });
    }

    // Fetch complete grant with all relations
    const completeGrant = await prisma.grantApplication.findUnique({
      where: { id: grantApplication.id },
      include: {
        consortiumOrganizations: true,
        investigators: {
          include: {
            consortiumOrg: true
          },
          orderBy: { displayOrder: 'asc' }
        },
        school: true,
        department: true,
        applicantUser: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: { firstName: true, lastName: true, displayName: true, designation: true }
            }
          }
        }
      }
    });

    // === COMPREHENSIVE AUDIT LOGGING ===
    await logResearchFiling(completeGrant, userId, req);
    
    // Log file upload if proposal was uploaded
    if (proposalFilePath) {
      await logFileUpload(
        proposalFilePath.split('/').pop(),
        req.file?.size || 0,
        proposalFilePath,
        userId,
        req,
        'RESEARCH',
        { grantId: grantApplication.id, type: 'proposal' }
      );
    }
    
    // Log submission if submitted immediately
    if (shouldSubmitImmediately) {
      await logResearchStatusChange(
        finalGrant,
        'draft',
        'submitted',
        userId,
        req,
        'Application submitted'
      );
    }
    // === END AUDIT LOGGING ===

    res.status(201).json({
      success: true,
      message: shouldSubmitImmediately ? 'Grant application submitted successfully' : 'Draft saved successfully',
      data: completeGrant
    });

  } catch (error) {
    console.error('Error creating grant application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create grant application',
      error: error.message
    });
  }
};

/**
 * Get all grant applications for current user
 */
exports.getMyGrantApplications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const grants = await prisma.grantApplication.findMany({
      where: {
        OR: [
          { applicantUserId: userId },
          { investigators: { some: { userId } } }
        ]
      },
      include: {
        school: true,
        department: true,
        consortiumOrganizations: true,
        investigators: {
          include: { consortiumOrg: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: grants
    });

  } catch (error) {
    console.error('Error fetching grant applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grant applications',
      error: error.message
    });
  }
};

/**
 * Get single grant application by ID
 */
exports.getGrantApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const grant = await prisma.grantApplication.findUnique({
      where: { id },
      include: {
        consortiumOrganizations: {
          orderBy: { displayOrder: 'asc' }
        },
        investigators: {
          include: { 
            consortiumOrg: true,
            user: {
              select: { uid: true, email: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        school: true,
        department: true,
        applicantUser: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: { firstName: true, lastName: true, displayName: true, designation: true }
            }
          }
        },
        reviews: {
          include: {
            reviewer: {
              select: { uid: true, email: true, employeeDetails: true }
            }
          }
        },
        statusHistory: {
          include: {
            changedBy: {
              select: { uid: true, email: true }
            }
          },
          orderBy: { changedAt: 'desc' }
        },
        editSuggestions: {
          include: {
            reviewer: {
              select: { uid: true, employeeDetails: { select: { displayName: true } } }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    console.log('Grant fetched with', grant.editSuggestions?.length || 0, 'edit suggestions');

    res.json({
      success: true,
      data: grant
    });

  } catch (error) {
    console.error('Error fetching grant application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grant application',
      error: error.message
    });
  }
};

/**
 * Update grant application
 */
exports.updateGrantApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const existingGrant = await prisma.grantApplication.findUnique({
      where: { id },
      include: { consortiumOrganizations: true, investigators: true }
    });

    if (!existingGrant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    // Check if user can edit
    if (existingGrant.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this application'
      });
    }

    // Check if editable status
    if (!['draft', 'changes_required'].includes(existingGrant.status)) {
      return res.status(400).json({
        success: false,
        message: 'This application cannot be edited in its current status'
      });
    }

    const {
      title,
      submittedAmount,
      sdgGoals,
      projectType,
      numberOfConsortiumOrgs,
      projectStatus,
      projectCategory,
      fundingAgencyType,
      fundingAgencyName,
      totalInvestigators,
      numberOfInternalPIs,
      numberOfInternalCoPIs,
      isPIExternal,
      myRole,
      dateOfSubmission,
      projectStartDate,
      projectEndDate,
      projectDurationMonths,
      schoolId,
      departmentId,
      consortiumOrganizations,
      investigators
    } = req.body;

    // Delete existing consortium orgs and investigators
    await prisma.grantInvestigator.deleteMany({
      where: { grantApplicationId: id }
    });
    await prisma.grantConsortiumOrganization.deleteMany({
      where: { grantApplicationId: id }
    });

    // Update grant application
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        title,
        submittedAmount: submittedAmount ? parseFloat(submittedAmount) : null,
        sdgGoals: sdgGoals || [],
        projectType: projectType || 'indian',
        numberOfConsortiumOrgs: numberOfConsortiumOrgs || 0,
        projectStatus: projectStatus || 'submitted',
        projectCategory: projectCategory || 'govt',
        fundingAgencyType: fundingAgencyType || null,
        fundingAgencyName: fundingAgencyName || null,
        totalInvestigators: totalInvestigators || 1,
        numberOfInternalPIs: numberOfInternalPIs || 1,
        numberOfInternalCoPIs: numberOfInternalCoPIs || 0,
        isPIExternal: isPIExternal || false,
        myRole: myRole || 'pi',
        dateOfSubmission: dateOfSubmission ? new Date(dateOfSubmission) : null,
        projectStartDate: projectStartDate ? new Date(projectStartDate) : null,
        projectEndDate: projectEndDate ? new Date(projectEndDate) : null,
        projectDurationMonths: projectDurationMonths ? parseInt(projectDurationMonths) : null,
        schoolId: schoolId || null,
        departmentId: departmentId || null,
        // Recreate consortium organizations
        consortiumOrganizations: projectType === 'international' && consortiumOrganizations?.length > 0 ? {
          create: consortiumOrganizations.map((org, index) => ({
            organizationName: org.organizationName,
            country: org.country,
            numberOfMembers: org.numberOfMembers || 1,
            displayOrder: index
          }))
        } : undefined
      },
      include: {
        consortiumOrganizations: true
      }
    });

    // Add investigators
    if (investigators && investigators.length > 0) {
      const orgIdMap = {};
      if (updatedGrant.consortiumOrganizations) {
        consortiumOrganizations?.forEach((inputOrg, index) => {
          const createdOrg = updatedGrant.consortiumOrganizations[index];
          if (createdOrg) {
            orgIdMap[inputOrg.id] = createdOrg.id;
          }
        });
      }

      for (const inv of investigators) {
        await prisma.grantInvestigator.create({
          data: {
            grantApplicationId: id,
            userId: inv.userId || null,
            uid: inv.uid || null,
            name: inv.name,
            email: inv.email || null,
            designation: inv.designation || null,
            affiliation: inv.affiliation || null,
            department: inv.department || null,
            roleType: inv.roleType || 'co_pi',
            isInternal: inv.isInternal !== false,
            investigatorType: inv.investigatorType || 'Faculty',
            consortiumOrgId: inv.consortiumOrgId ? orgIdMap[inv.consortiumOrgId] : null,
            isTeamCoordinator: inv.isTeamCoordinator || false,
            displayOrder: inv.displayOrder || 0
          }
        });
      }
    }

    // Fetch complete updated grant
    const completeGrant = await prisma.grantApplication.findUnique({
      where: { id },
      include: {
        consortiumOrganizations: true,
        investigators: {
          include: { consortiumOrg: true },
          orderBy: { displayOrder: 'asc' }
        },
        school: true,
        department: true
      }
    });

    res.json({
      success: true,
      message: 'Grant application updated successfully',
      data: completeGrant
    });

  } catch (error) {
    console.error('Error updating grant application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update grant application',
      error: error.message
    });
  }
};

/**
 * Submit grant application
 */
exports.submitGrantApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (grant.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to submit this application'
      });
    }

    if (!['draft', 'changes_required'].includes(grant.status)) {
      return res.status(400).json({
        success: false,
        message: 'This application cannot be submitted in its current status'
      });
    }

    // Generate application number if not exists
    let applicationNumber = grant.applicationNumber;
    if (!applicationNumber) {
      applicationNumber = await generateApplicationNumber();
    }

    // Determine new status based on current status
    const newStatus = grant.status === 'changes_required' ? 'resubmitted' : 'submitted';
    const statusComment = grant.status === 'changes_required' ? 'Resubmitted after changes' : 'Application submitted for review';

    // Update status
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        applicationNumber,
        status: newStatus,
        submittedAt: new Date(),
        revisionCount: grant.status === 'changes_required' ? grant.revisionCount + 1 : grant.revisionCount
      }
    });

    // Create status history
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: id,
        fromStatus: grant.status,
        toStatus: newStatus,
        changedById: userId,
        comments: statusComment
      }
    });

    res.json({
      success: true,
      message: 'Grant application submitted successfully',
      data: updatedGrant
    });

  } catch (error) {
    console.error('Error submitting grant application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit grant application',
      error: error.message
    });
  }
};

/**
 * Delete grant application (only drafts)
 */
exports.deleteGrantApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (grant.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this application'
      });
    }

    if (grant.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft applications can be deleted'
      });
    }

    await prisma.grantApplication.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Grant application deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting grant application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete grant application',
      error: error.message
    });
  }
};

/**
 * Get pending grant applications for review (DRD)
 */
exports.getPendingGrantReviews = async (req, res) => {
  try {
    const userId = req.user?.id;

    // Check if user has DRD permissions
    const userDrdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId,
        isActive: true,
        centralDept: {
          OR: [
            { departmentCode: 'DRD' },
            { shortName: 'DRD' }
          ]
        }
      }
    });

    if (!userDrdPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - No DRD permissions'
      });
    }

    const permissions = userDrdPermission.permissions || {};
    const hasReviewPerm = permissions.research_review === true || permissions.grant_review === true;
    const hasApprovePerm = permissions.research_approve === true || permissions.grant_approve === true;

    if (!hasReviewPerm && !hasApprovePerm) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - No grant review permissions'
      });
    }

    // Get assigned school IDs
    const assignedSchoolIds = userDrdPermission.assignedSchoolIds || 
                              userDrdPermission.assignedResearchSchoolIds || 
                              [];

    // Define status filter based on user permissions
    let statusFilter;
    if (hasApprovePerm) {
      // Approvers can see: submitted, under_review, resubmitted, AND recommended
      statusFilter = ['submitted', 'under_review', 'resubmitted', 'recommended'];
    } else {
      // Reviewers (without approve permission) see: submitted, under_review, resubmitted
      statusFilter = ['submitted', 'under_review', 'resubmitted'];
    }

    const whereClause = {
      status: {
        in: statusFilter
      }
    };

    // Filter by assigned schools if not head
    if (!hasApprovePerm && assignedSchoolIds.length > 0) {
      whereClause.schoolId = { in: assignedSchoolIds };
    }

    const grants = await prisma.grantApplication.findMany({
      where: whereClause,
      include: {
        school: true,
        department: true,
        applicantUser: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: { firstName: true, lastName: true, displayName: true }
            }
          }
        },
        consortiumOrganizations: true,
        investigators: true
      },
      orderBy: { submittedAt: 'asc' }
    });

    res.json({
      success: true,
      data: grants
    });

  } catch (error) {
    console.error('Error fetching pending grant reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reviews',
      error: error.message
    });
  }
};

/**
 * Start reviewing a grant application
 */
exports.startReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (!['submitted', 'resubmitted'].includes(grant.status)) {
      return res.status(400).json({
        success: false,
        message: 'Grant application cannot be reviewed in its current status'
      });
    }

    // Update status
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        status: 'under_review',
        currentReviewerId: userId
      }
    });

    // Create review record
    await prisma.grantApplicationReview.create({
      data: {
        grantApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'reviewer',
        decision: 'reviewing',
        comments: 'Review started'
      }
    });

    // Create status history
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: id,
        fromStatus: grant.status,
        toStatus: 'under_review',
        changedById: userId,
        comments: 'Review process started'
      }
    });

    res.json({
      success: true,
      message: 'Review started successfully',
      data: updatedGrant
    });

  } catch (error) {
    console.error('Error starting grant review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start review',
      error: error.message
    });
  }
};

/**
 * Request changes on a grant application
 */
exports.requestChanges = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments, suggestions } = req.body;

    if (!comments && (!suggestions || suggestions.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Comments or field suggestions are required when requesting changes'
      });
    }

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (!['under_review', 'resubmitted', 'recommended'].includes(grant.status)) {
      return res.status(400).json({
        success: false,
        message: 'Changes can only be requested for applications under review, resubmitted, or recommended'
      });
    }

    // Update status
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        status: 'changes_required',
        currentReviewerId: null
      }
    });

    // Create review record
    await prisma.grantApplicationReview.create({
      data: {
        grantApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'reviewer',
        decision: 'changes_required',
        comments: comments || 'Field changes suggested',
        reviewedAt: new Date()
      }
    });

    // Save field suggestions if provided
    if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
      console.log('Saving field suggestions:', suggestions);
      await Promise.all(suggestions.map(suggestion => 
        prisma.grantApplicationEditSuggestion.create({
          data: {
            grantApplicationId: id,
            reviewerId: userId,
            fieldName: suggestion.fieldName,
            fieldPath: suggestion.fieldPath,
            originalValue: suggestion.originalValue || '',
            suggestedValue: suggestion.suggestedValue || '',
            suggestionNote: suggestion.note || '',
            status: 'pending'
          }
        })
      ));
      console.log('Field suggestions saved successfully');
    } else {
      console.log('No suggestions to save or suggestions is not an array:', suggestions);
    }

    // Create status history
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: id,
        fromStatus: grant.status, // Use the current status before update
        toStatus: 'changes_required',
        changedById: userId,
        comments: comments || 'Field changes suggested'
      }
    });

    res.json({
      success: true,
      message: 'Changes requested successfully',
      data: updatedGrant
    });

  } catch (error) {
    console.error('Error requesting changes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request changes',
      error: error.message
    });
  }
};

/**
 * Recommend grant application for approval
 */
exports.recommendForApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments } = req.body;

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (!['under_review', 'resubmitted'].includes(grant.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only applications under review or resubmitted can be recommended'
      });
    }

    // Change status to recommended (waiting for DRD head approval)
    const previousStatus = grant.status;
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        status: 'recommended',
        currentReviewerId: null
      }
    });

    // Create review record
    await prisma.grantApplicationReview.create({
      data: {
        grantApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'reviewer',
        decision: 'recommended',
        comments: comments || 'Recommended for approval',
        reviewedAt: new Date()
      }
    });

    // Create status history
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: id,
        fromStatus: previousStatus,
        toStatus: 'recommended',
        changedById: userId,
        comments: comments || 'Recommended for approval by reviewer'
      }
    });

    res.json({
      success: true,
      message: 'Grant application recommended for approval',
      data: updatedGrant
    });

  } catch (error) {
    console.error('Error recommending grant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recommend grant',
      error: error.message
    });
  }
};

/**
 * Approve grant application (DRD Head)
 */
exports.approveGrant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments } = req.body;

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (!['under_review', 'resubmitted', 'recommended'].includes(grant.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only applications under review, resubmitted, or recommended can be approved'
      });
    }

    const previousStatus = grant.status;

    // Calculate incentives based on policy
    let calculatedIncentiveAmount = null;
    let calculatedPoints = null;

    try {
      const currentDate = new Date();
      const policy = await prisma.grantIncentivePolicy.findFirst({
        where: {
          projectCategory: grant.projectCategory,
          projectType: grant.projectType,
          isActive: true,
          effectiveFrom: { lte: currentDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: currentDate } }
          ]
        },
        orderBy: { effectiveFrom: 'desc' }
      });

      if (policy) {
        // Calculate base incentive
        calculatedIncentiveAmount = parseFloat(policy.baseIncentiveAmount.toString());
        calculatedPoints = policy.basePoints;

        // Add international bonus if applicable
        if (grant.projectType === 'international' && policy.internationalBonus) {
          calculatedIncentiveAmount += parseFloat(policy.internationalBonus.toString());
        }

        // Add consortium bonus if applicable
        if (grant.numberOfConsortiumOrgs && grant.numberOfConsortiumOrgs > 0 && policy.consortiumBonus) {
          calculatedIncentiveAmount += parseFloat(policy.consortiumBonus.toString()) * grant.numberOfConsortiumOrgs;
        }

        console.log(`Grant ${grant.applicationNumber} - Calculated incentive: ₹${calculatedIncentiveAmount}, Points: ${calculatedPoints}`);
      } else {
        console.log(`No active policy found for ${grant.projectCategory} ${grant.projectType} grant`);
      }
    } catch (policyError) {
      console.error('Error calculating grant incentive:', policyError);
      // Continue with approval even if policy calculation fails
    }

    // Update status to approved with calculated incentives
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedById: userId,
        currentReviewerId: null,
        calculatedIncentiveAmount: calculatedIncentiveAmount,
        calculatedPoints: calculatedPoints,
        // Initially set incentive amount and points to calculated values
        // Finance can adjust these later if needed
        incentiveAmount: calculatedIncentiveAmount,
        pointsAwarded: calculatedPoints
      }
    });

    // Create review record
    await prisma.grantApplicationReview.create({
      data: {
        grantApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'approver',
        decision: 'approved',
        comments: comments || 'Grant application approved',
        reviewedAt: new Date()
      }
    });

    // Create status history
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: id,
        fromStatus: previousStatus,
        toStatus: 'approved',
        changedById: userId,
        comments: comments || 'Grant application approved by DRD'
      }
    });

    res.json({
      success: true,
      message: 'Grant application approved successfully',
      data: updatedGrant
    });

  } catch (error) {
    console.error('Error approving grant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve grant',
      error: error.message
    });
  }
};

/**
 * Reject grant application
 */
exports.rejectGrant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments, reason } = req.body;

    if (!comments && !reason) {
      return res.status(400).json({
        success: false,
        message: 'Comments or reason required when rejecting'
      });
    }

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (!['under_review', 'submitted', 'resubmitted', 'recommended'].includes(grant.status)) {
      return res.status(400).json({
        success: false,
        message: 'Grant application cannot be rejected in its current status'
      });
    }

    // Update status
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedById: userId,
        currentReviewerId: null
      }
    });

    // Create review record
    await prisma.grantApplicationReview.create({
      data: {
        grantApplicationId: id,
        reviewerId: userId,
        reviewerRole: 'approver',
        decision: 'rejected',
        comments: comments || reason || 'Grant application rejected',
        reviewedAt: new Date()
      }
    });

    // Create status history
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: id,
        fromStatus: grant.status,
        toStatus: 'rejected',
        changedById: userId,
        comments: comments || reason || 'Grant application rejected'
      }
    });

    res.json({
      success: true,
      message: 'Grant application rejected',
      data: updatedGrant
    });

  } catch (error) {
    console.error('Error rejecting grant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject grant',
      error: error.message
    });
  }
};

/**
 * Mark grant application as completed
 */
exports.markCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const grant = await prisma.grantApplication.findUnique({
      where: { id }
    });

    if (!grant) {
      return res.status(404).json({
        success: false,
        message: 'Grant application not found'
      });
    }

    if (grant.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved grants can be marked as completed'
      });
    }

    // Update status
    const updatedGrant = await prisma.grantApplication.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    // Create status history
    await prisma.grantApplicationStatusHistory.create({
      data: {
        grantApplicationId: id,
        fromStatus: 'approved',
        toStatus: 'completed',
        changedById: userId,
        comments: 'Grant application marked as completed'
      }
    });

    res.json({
      success: true,
      message: 'Grant application marked as completed',
      data: updatedGrant
    });

  } catch (error) {
    console.error('Error marking grant as completed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark grant as completed',
      error: error.message
    });
  }
};

/**
 * Accept or reject a field suggestion for grant application
 */
exports.respondToGrantSuggestion = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { accept } = req.body;
    const userId = req.user?.id;

    const suggestion = await prisma.grantApplicationEditSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        grantApplication: true
      }
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    // Verify applicant is the owner
    if (suggestion.grantApplication.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to respond to this suggestion'
      });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This suggestion has already been responded to'
      });
    }

    // Update suggestion status
    const updatedSuggestion = await prisma.grantApplicationEditSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: accept ? 'accepted' : 'rejected',
        respondedAt: new Date()
      }
    });

    // If accepted, update the grant field
    if (accept) {
      const updateData = {};
      let value = suggestion.suggestedValue;
      
      // Convert value based on field type
      const fieldName = suggestion.fieldName;
      
      // Number fields
      if (['submittedAmount', 'totalInvestigators', 'numberOfInternalPIs', 'numberOfInternalCoPIs', 'numberOfConsortiumOrgs', 'projectDurationMonths'].includes(fieldName)) {
        value = parseInt(value, 10);
      }
      // Date fields - convert to ISO DateTime
      else if (['dateOfSubmission', 'projectStartDate', 'projectEndDate'].includes(fieldName)) {
        // Add time component if not present
        if (value && !value.includes('T')) {
          value = new Date(value + 'T00:00:00.000Z').toISOString();
        }
      }
      // Array fields
      else if (fieldName === 'sdgGoals') {
        value = value ? value.split(',').filter(Boolean) : [];
      }
      // Boolean fields
      else if (fieldName === 'isPIExternal') {
        value = value === 'true' || value === true;
      }
      // Enum fields - convert to lowercase
      else if (['fundingAgencyType', 'projectStatus', 'projectCategory'].includes(fieldName)) {
        value = value ? value.toLowerCase() : value;
      }
      
      updateData[fieldName] = value;
      
      await prisma.grantApplication.update({
        where: { id: suggestion.grantApplicationId },
        data: updateData
      });
    }

    res.json({
      success: true,
      message: accept ? 'Suggestion accepted and applied' : 'Suggestion rejected',
      data: updatedSuggestion
    });

  } catch (error) {
    console.error('Error responding to suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to suggestion',
      error: error.message
    });
  }
};
