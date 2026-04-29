const prisma = require('../../../shared/config/database');

// Valid enum values for validation
const ENUM_VALUES = {
  iprType: ['patent', 'copyright', 'trademark', 'design'],
  projectType: ['phd', 'pg_project', 'ug_project', 'faculty_research', 'industry_collaboration', 'any_other'],
  filingType: ['provisional', 'complete']
};

/**
 * Start a collaborative editing session
 */
exports.startCollaborativeSession = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;

    // Check if user has permission to review this IPR
    const hasPermission = await checkReviewPermission(userId, iprApplicationId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to review this IPR application'
      });
    }

    // Check if there's already an active session
    const existingSession = await prisma.iprCollaborativeSession.findFirst({
      where: {
        iprApplicationId,
        reviewerId: userId,
        isActive: true
      }
    });

    if (existingSession) {
      return res.json({
        success: true,
        data: existingSession,
        message: 'Existing active session found'
      });
    }

    // Create new collaborative session
    const session = await prisma.iprCollaborativeSession.create({
      data: {
        iprApplicationId,
        reviewerId: userId,
        sessionData: {},
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      data: session,
      message: 'Collaborative editing session started'
    });
  } catch (error) {
    console.error('Start collaborative session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start collaborative editing session'
    });
  }
};

/**
 * Create an edit suggestion
 */
exports.createEditSuggestion = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;
    const {
      fieldName,
      fieldPath,
      originalValue,
      suggestedValue,
      suggestionNote
    } = req.body;

    // Validate required fields
    if (!fieldName || !suggestedValue) {
      return res.status(400).json({
        success: false,
        message: 'Field name and suggested value are required'
      });
    }

    // Check if user has permission to review this IPR
    const hasPermission = await checkReviewPermission(userId, iprApplicationId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to review this IPR application'
      });
    }

    // Get the IPR application to find the applicant
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id: iprApplicationId },
      select: {
        id: true,
        title: true,
        applicantUserId: true,
        status: true,
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Create the edit suggestion
    const suggestion = await prisma.iprEditSuggestion.create({
      data: {
        iprApplicationId,
        reviewerId: userId,
        fieldName,
        fieldPath,
        originalValue,
        suggestedValue,
        suggestionNote,
        status: 'pending'
      },
      include: {
        reviewer: {
          select: {
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Get reviewer name for notification
    const reviewerName = suggestion.reviewer?.employeeDetails?.displayName ||
      suggestion.reviewer?.employeeDetails?.firstName ||
      suggestion.reviewer?.uid || 'DRD Reviewer';

    // Update IPR status to changes_required if not already
    if (iprApplication.status !== 'changes_required') {
      await prisma.iprApplication.update({
        where: { id: iprApplicationId },
        data: { status: 'changes_required' }
      });

      // Create status history entry
      await prisma.iprStatusHistory.create({
        data: {
          iprApplicationId,
          fromStatus: iprApplication.status,
          toStatus: 'changes_required',
          changedById: userId,
          comments: `Changes requested by ${reviewerName}: ${suggestionNote || fieldName}`,
          metadata: { fieldName, suggestionId: suggestion.id, action: 'request_changes' }
        }
      });
    }

    // Send notification to the applicant
    await prisma.notification.create({
      data: {
        userId: iprApplication.applicantUserId,
        type: 'ipr_changes_requested',
        title: 'Changes Requested for Your IPR Application',
        message: `${reviewerName} has suggested changes to "${fieldName}" in your IPR "${iprApplication.title}". Please review and respond to the suggestions.`,
        referenceType: 'ipr_application',
        referenceId: iprApplicationId,
        metadata: {
          suggestionId: suggestion.id,
          fieldName,
          reviewerName,
          actionUrl: `/ipr/my-applications/${iprApplicationId}`,
          actionLabel: 'View & Respond'
        }
      }
    });

    // Update review statistics
    await updateReviewSuggestionCounts(iprApplicationId);

    res.status(201).json({
      success: true,
      data: suggestion,
      message: 'Edit suggestion created successfully'
    });
  } catch (error) {
    console.error('Create edit suggestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create edit suggestion'
    });
  }
};

/**
 * Get edit suggestions for an IPR application
 */
exports.getEditSuggestions = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const { status } = req.query;

    const where = { iprApplicationId };
    if (status) {
      where.status = status;
    }

    const suggestions = await prisma.iprEditSuggestion.findMany({
      where,
      include: {
        reviewer: {
          select: {
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Group suggestions by field
    const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
      const key = suggestion.fieldPath || suggestion.fieldName;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(suggestion);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        suggestions,
        groupedSuggestions,
        summary: {
          total: suggestions.length,
          pending: suggestions.filter(s => s.status === 'pending').length,
          accepted: suggestions.filter(s => s.status === 'accepted').length,
          rejected: suggestions.filter(s => s.status === 'rejected').length
        }
      }
    });
  } catch (error) {
    console.error('Get edit suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get edit suggestions'
    });
  }
};

/**
 * Respond to edit suggestion (accept/reject by applicant)
 */
exports.respondToSuggestion = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const userId = req.user.id;
    const { action, response } = req.body; // action: 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "accept" or "reject"'
      });
    }

    // Get the suggestion with IPR application
    const suggestion = await prisma.iprEditSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        iprApplication: true
      }
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Edit suggestion not found'
      });
    }

    // Check if user is the applicant
    if (suggestion.iprApplication.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to suggestions on your own applications'
      });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This suggestion has already been responded to'
      });
    }

    // Update suggestion status
    const updatedSuggestion = await prisma.$transaction(async (tx) => {
      // Update the suggestion
      const updated = await tx.iprEditSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: action === 'accept' ? 'accepted' : 'rejected',
          applicantResponse: response,
          respondedAt: new Date()
        },
        include: {
          reviewer: {
            select: {
              uid: true,
              employeeDetails: {
                select: {
                  displayName: true
                }
              }
            }
          }
        }
      });

      // If accepted, apply the change to the IPR application
      if (action === 'accept') {
        await applyEditSuggestion(tx, suggestion);
      }

      return updated;
    });

    // Get applicant info for notification
    const applicant = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        uid: true,
        employeeDetails: {
          select: { displayName: true, firstName: true }
        }
      }
    });
    const applicantName = applicant?.employeeDetails?.displayName ||
      applicant?.employeeDetails?.firstName ||
      applicant?.uid || 'Applicant';

    // Notify the reviewer about the response
    await prisma.notification.create({
      data: {
        userId: suggestion.reviewerId,
        type: 'ipr_suggestion_response',
        title: `Your suggestion was ${action}ed`,
        message: `${applicantName} has ${action}ed your suggested change to "${suggestion.fieldName}" in IPR "${suggestion.iprApplication.title}".${response ? ` Response: "${response}"` : ''}`,
        referenceType: 'ipr_application',
        referenceId: suggestion.iprApplicationId,
        metadata: {
          suggestionId: suggestion.id,
          fieldName: suggestion.fieldName,
          action,
          applicantResponse: response,
          actionUrl: `/drd-review/${suggestion.iprApplicationId}`,
          actionLabel: 'View Application'
        }
      }
    });

    // Check if all pending suggestions are resolved - then update status
    const pendingSuggestions = await prisma.iprEditSuggestion.count({
      where: {
        iprApplicationId: suggestion.iprApplicationId,
        status: 'pending'
      }
    });

    if (pendingSuggestions === 0) {
      // Check if this was a mentor suggestion (prefixed with [MENTOR])
      const isMentorSuggestion = suggestion.suggestionNote?.startsWith('[MENTOR]');
      
      // Also check if there are any other mentor suggestions that were addressed
      const mentorSuggestionsCount = await prisma.iprEditSuggestion.count({
        where: {
          iprApplicationId: suggestion.iprApplicationId,
          suggestionNote: { startsWith: '[MENTOR]' },
          status: { in: ['accepted', 'rejected'] }
        }
      });
      
      // If mentor suggestions exist, go back to pending_mentor_approval
      const newStatus = (isMentorSuggestion || mentorSuggestionsCount > 0) 
        ? 'pending_mentor_approval' 
        : 'resubmitted';
      
      await prisma.iprApplication.update({
        where: { id: suggestion.iprApplicationId },
        data: { status: newStatus }
      });

      // Create status history
      await prisma.iprStatusHistory.create({
        data: {
          iprApplicationId: suggestion.iprApplicationId,
          fromStatus: 'changes_required',
          toStatus: newStatus,
          changedById: userId,
          comments: newStatus === 'pending_mentor_approval'
            ? 'All mentor suggestions addressed - awaiting mentor review'
            : 'All requested changes have been addressed',
          metadata: { action: 'resubmit' }
        }
      });

      // Notify mentor or DRD reviewer based on flow
      if (newStatus === 'pending_mentor_approval') {
        // Notify mentor
        const iprApp = await prisma.iprApplication.findUnique({
          where: { id: suggestion.iprApplicationId },
          select: { applicantDetails: { select: { mentorUid: true } } }
        });
        
        if (iprApp?.applicantDetails?.mentorUid) {
          const mentor = await prisma.userLogin.findFirst({
            where: { uid: iprApp.applicantDetails.mentorUid }
          });
          
          if (mentor) {
            await prisma.notification.create({
              data: {
                userId: mentor.id,
                type: 'ipr_mentor_review_ready',
                title: 'Student Responded to Your Suggestions',
                message: `${applicantName} has addressed your suggested changes in IPR "${suggestion.iprApplication.title}". Please review and decide to approve or request more changes.`,
                referenceType: 'ipr_application',
                referenceId: suggestion.iprApplicationId,
                metadata: {
                  actionUrl: `/mentor/ipr/${suggestion.iprApplicationId}`,
                  actionLabel: 'Review Application'
                }
              }
            });
          }
        }
      } else if (suggestion.iprApplication.currentReviewerId) {
        // Notify DRD reviewer
        await prisma.notification.create({
          data: {
            userId: suggestion.iprApplication.currentReviewerId,
            type: 'ipr_resubmitted',
            title: 'IPR Application Resubmitted',
            message: `${applicantName} has addressed all requested changes in IPR "${suggestion.iprApplication.title}". The application is ready for your review.`,
            referenceType: 'ipr_application',
            referenceId: suggestion.iprApplicationId,
            metadata: {
              actionUrl: `/drd-review/${suggestion.iprApplicationId}`,
              actionLabel: 'Review Application'
            }
          }
        });
      }
    }

    // Update review statistics
    await updateReviewSuggestionCounts(suggestion.iprApplicationId);

    res.json({
      success: true,
      data: updatedSuggestion,
      message: `Edit suggestion ${action}ed successfully`
    });
  } catch (error) {
    console.error('Respond to suggestion error:', error);
    
    // Check if it's a validation error (invalid enum value)
    if (error.message && error.message.includes('Invalid value')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    // Check for Prisma validation errors
    if (error.name === 'PrismaClientValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid value for one of the fields. The suggested value may not be valid for this field type.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to respond to suggestion'
    });
  }
};

/**
 * Get collaborative editing session
 */
exports.getCollaborativeSession = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;

    const session = await prisma.iprCollaborativeSession.findFirst({
      where: {
        iprApplicationId,
        reviewerId: userId,
        isActive: true
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active collaborative session found'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Get collaborative session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get collaborative session'
    });
  }
};

/**
 * End collaborative editing session
 */
exports.endCollaborativeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.iprCollaborativeSession.update({
      where: {
        id: sessionId,
        reviewerId: userId
      },
      data: {
        isActive: false,
        endedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: session,
      message: 'Collaborative editing session ended'
    });
  } catch (error) {
    console.error('End collaborative session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end collaborative session'
    });
  }
};

/**
 * Helper function to check review permission
 */
async function checkReviewPermission(userId, iprApplicationId, checkMentor = false) {
  // Get user info
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    include: {
      centralDeptPermissions: {
        where: { isActive: true },
        select: {
          permissions: true
        }
      }
    }
  });

  if (!user) return false;

  // Check if user has any DRD review permission (supports both naming conventions)
  const hasDrdPermission = user.centralDeptPermissions.some(perm => 
    perm.permissions && (
      perm.permissions.ipr_review === true ||
      perm.permissions.ipr_approve === true ||
      perm.permissions.drd_ipr_review === true ||
      perm.permissions.drd_ipr_approve === true
    )
  );
  
  if (hasDrdPermission) return true;
  
  // Check if user is the mentor for this IPR application
  if (checkMentor) {
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id: iprApplicationId },
      include: {
        applicantDetails: {
          select: { mentorUid: true }
        }
      }
    });
    
    if (iprApplication?.applicantDetails?.mentorUid === user.uid) {
      return true;
    }
  }
  
  return false;
}

/**
 * Helper function to apply edit suggestion to IPR application
 */
async function applyEditSuggestion(tx, suggestion) {
  const { iprApplicationId, fieldName, suggestedValue } = suggestion;

  // Build the update data based on field name
  const updateData = {};
  
  // Map field names to actual database columns
  const fieldMapping = {
    'title': 'title',
    'description': 'description',
    'remarks': 'remarks',
    'iprType': 'iprType',
    'projectType': 'projectType',
    'filingType': 'filingType'
  };

  // Valid enum values for validation
  const enumValidation = {
    'iprType': ['patent', 'copyright', 'trademark', 'design'],
    'projectType': ['phd', 'pg_project', 'ug_project', 'faculty_research', 'industry_collaboration', 'any_other'],
    'filingType': ['provisional', 'complete']
  };

  const dbField = fieldMapping[fieldName] || fieldName;
  
  // Validate enum fields before applying
  if (enumValidation[dbField]) {
    if (!enumValidation[dbField].includes(suggestedValue)) {
      throw new Error(`Invalid value "${suggestedValue}" for ${fieldName}. Must be one of: ${enumValidation[dbField].join(', ')}`);
    }
  }
  
  updateData[dbField] = suggestedValue;

  // Apply the change to the IPR application
  await tx.iprApplication.update({
    where: { id: iprApplicationId },
    data: updateData
  });

  // Create status history entry
  await tx.iprStatusHistory.create({
    data: {
      iprApplicationId,
      fromStatus: null, // Field edit, not status change
      toStatus: 'changes_required', // Maintain current status but record the edit
      changedById: suggestion.reviewerId,
      comments: `Applied edit suggestion for ${fieldName}: "${suggestedValue}"`,
      metadata: {
        type: 'edit_suggestion_applied',
        suggestionId: suggestion.id,
        fieldName: fieldName,
        suggestedValue: suggestedValue
      }
    }
  });
}

/**
 * Helper function to update review suggestion counts
 */
async function updateReviewSuggestionCounts(iprApplicationId) {
  const totalSuggestions = await prisma.iprEditSuggestion.count({
    where: { iprApplicationId }
  });

  const pendingSuggestions = await prisma.iprEditSuggestion.count({
    where: { 
      iprApplicationId,
      status: 'pending'
    }
  });

  // Update the review record
  await prisma.iprReview.updateMany({
    where: { iprApplicationId },
    data: {
      hasSuggestions: totalSuggestions > 0,
      suggestionsCount: totalSuggestions,
      pendingSuggestionsCount: pendingSuggestions
    }
  });
}

/**
 * Submit batch suggestions (Reviewer submits all suggestions at once)
 */
exports.submitBatchSuggestions = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;
    const { suggestions, reviewComments } = req.body;

    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one suggestion is required'
      });
    }

    // Check permission
    const hasPermission = await checkReviewPermission(userId, iprApplicationId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to review this IPR application'
      });
    }

    // Get the IPR application
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id: iprApplicationId },
      select: {
        id: true,
        title: true,
        applicantUserId: true,
        status: true,
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Validate all suggestions before creating
    for (const suggestion of suggestions) {
      if (!suggestion.fieldName || !suggestion.suggestedValue) {
        return res.status(400).json({
          success: false,
          message: 'Each suggestion must have fieldName and suggestedValue'
        });
      }

      // Validate enum values
      if (ENUM_VALUES[suggestion.fieldName]) {
        if (!ENUM_VALUES[suggestion.fieldName].includes(suggestion.suggestedValue)) {
          return res.status(400).json({
            success: false,
            message: `Invalid value "${suggestion.suggestedValue}" for ${suggestion.fieldName}. Must be one of: ${ENUM_VALUES[suggestion.fieldName].join(', ')}`
          });
        }
      }
    }

    // Create all suggestions in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create suggestions
      const createdSuggestions = await Promise.all(
        suggestions.map(suggestion => 
          tx.iprEditSuggestion.create({
            data: {
              iprApplicationId,
              reviewerId: userId,
              fieldName: suggestion.fieldName,
              fieldPath: suggestion.fieldPath,
              originalValue: suggestion.originalValue,
              suggestedValue: suggestion.suggestedValue,
              suggestionNote: suggestion.suggestionNote,
              status: 'pending'
            }
          })
        )
      );

      // Update IPR status to changes_required
      await tx.iprApplication.update({
        where: { id: iprApplicationId },
        data: { 
          status: 'changes_required',
          currentReviewerId: userId
        }
      });

      // Create status history
      await tx.iprStatusHistory.create({
        data: {
          iprApplicationId,
          fromStatus: iprApplication.status,
          toStatus: 'changes_required',
          changedById: userId,
          comments: reviewComments || `Reviewer submitted ${suggestions.length} edit suggestions`,
          metadata: { action: 'request_changes' }
        }
      });

      // Create or update review record
      await tx.iprReview.upsert({
        where: {
          iprApplicationId_reviewerId: {
            iprApplicationId,
            reviewerId: userId
          }
        },
        create: {
          iprApplicationId,
          reviewerId: userId,
          reviewerRole: 'drd_member',
          comments: reviewComments,
          decision: 'changes_required',
          hasSuggestions: true,
          suggestionsCount: createdSuggestions.length,
          pendingSuggestionsCount: createdSuggestions.length,
          reviewedAt: new Date()
        },
        update: {
          comments: reviewComments,
          decision: 'changes_required',
          hasSuggestions: true,
          suggestionsCount: { increment: createdSuggestions.length },
          pendingSuggestionsCount: { increment: createdSuggestions.length },
          reviewedAt: new Date()
        }
      });

      return createdSuggestions;
    });

    // Get reviewer name
    const reviewer = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        uid: true,
        employeeDetails: { select: { displayName: true, firstName: true } }
      }
    });
    const reviewerName = reviewer?.employeeDetails?.displayName ||
      reviewer?.employeeDetails?.firstName ||
      reviewer?.uid || 'DRD Reviewer';

    // Send notification to applicant
    await prisma.notification.create({
      data: {
        userId: iprApplication.applicantUserId,
        type: 'ipr_changes_requested',
        title: 'Changes Requested for Your IPR Application',
        message: `${reviewerName} has reviewed your IPR "${iprApplication.title}" and suggested ${suggestions.length} changes. Please review and respond to the suggestions.`,
        referenceType: 'ipr_application',
        referenceId: iprApplicationId,
        metadata: {
          reviewerName,
          suggestionsCount: suggestions.length,
          actionUrl: `/ipr/my-applications`,
          actionLabel: 'Review Suggestions'
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        suggestions: result,
        count: result.length
      },
      message: `Successfully submitted ${result.length} edit suggestions`
    });
  } catch (error) {
    console.error('Submit batch suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit suggestions'
    });
  }
};

/**
 * Respond to all suggestions at once (Applicant batch response)
 */
exports.respondToBatchSuggestions = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;
    const { responses } = req.body;

    // responses is an array of { suggestionId, action: 'accept'|'reject', response?: string }

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one response is required'
      });
    }

    // Get IPR application
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id: iprApplicationId },
      select: {
        id: true,
        title: true,
        status: true,
        applicantUserId: true,
        currentReviewerId: true,
        applicantDetails: {
          select: {
            mentorUid: true
          }
        }
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Check if user is the applicant
    if (iprApplication.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to suggestions on your own applications'
      });
    }

    // Validate all responses
    for (const response of responses) {
      if (!response.suggestionId || !['accept', 'reject'].includes(response.action)) {
        return res.status(400).json({
          success: false,
          message: 'Each response must have suggestionId and action (accept or reject)'
        });
      }
    }

    // Get all suggestions to validate and process
    const suggestionIds = responses.map(r => r.suggestionId);
    const existingSuggestions = await prisma.iprEditSuggestion.findMany({
      where: {
        id: { in: suggestionIds },
        iprApplicationId,
        status: 'pending'
      }
    });

    if (existingSuggestions.length !== responses.length) {
      return res.status(400).json({
        success: false,
        message: 'Some suggestions are invalid or already responded to'
      });
    }

    // Validate enum values for accepted suggestions
    for (const response of responses) {
      if (response.action === 'accept') {
        const suggestion = existingSuggestions.find(s => s.id === response.suggestionId);
        if (suggestion && ENUM_VALUES[suggestion.fieldName]) {
          if (!ENUM_VALUES[suggestion.fieldName].includes(suggestion.suggestedValue)) {
            return res.status(400).json({
              success: false,
              message: `Cannot accept suggestion: Invalid value "${suggestion.suggestedValue}" for ${suggestion.fieldName}`
            });
          }
        }
      }
    }

    // Process all responses in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedSuggestions = [];

      for (const response of responses) {
        const suggestion = existingSuggestions.find(s => s.id === response.suggestionId);
        
        // Update suggestion status
        const updated = await tx.iprEditSuggestion.update({
          where: { id: response.suggestionId },
          data: {
            status: response.action === 'accept' ? 'accepted' : 'rejected',
            applicantResponse: response.response || null,
            respondedAt: new Date()
          }
        });

        // If accepted, apply the change
        if (response.action === 'accept' && suggestion) {
          await applyEditSuggestion(tx, suggestion);
        }

        updatedSuggestions.push(updated);
      }

      // Check remaining pending suggestions
      const remainingPending = await tx.iprEditSuggestion.count({
        where: {
          iprApplicationId,
          status: 'pending'
        }
      });

      // If all suggestions are responded to, determine next status
      let newStatus = null;
      if (remainingPending === 0) {
        // Check if these were mentor suggestions (prefixed with [MENTOR])
        const mentorSuggestionsCount = await tx.iprEditSuggestion.count({
          where: {
            iprApplicationId,
            suggestionNote: { startsWith: '[MENTOR]' },
            status: { in: ['accepted', 'rejected'] }
          }
        });

        // If there were mentor suggestions, go back to pending_mentor_approval
        // so mentor can review the responses and decide to approve or request more changes
        if (mentorSuggestionsCount > 0) {
          newStatus = 'pending_mentor_approval';
        } else {
          newStatus = 'resubmitted';
        }

        await tx.iprApplication.update({
          where: { id: iprApplicationId },
          data: { status: newStatus }
        });

        await tx.iprStatusHistory.create({
          data: {
            iprApplicationId,
            fromStatus: 'changes_required',
            toStatus: newStatus,
            changedById: userId,
            comments: newStatus === 'pending_mentor_approval' 
              ? 'All mentor suggestions addressed - awaiting mentor review'
              : 'All requested changes have been addressed'
          }
        });
      }

      return { updatedSuggestions, remainingPending, newStatus };
    });

    // Get applicant name for notification
    const applicant = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        uid: true,
        employeeDetails: { select: { displayName: true, firstName: true } }
      }
    });
    const applicantName = applicant?.employeeDetails?.displayName ||
      applicant?.employeeDetails?.firstName ||
      applicant?.uid || 'Applicant';

    // Count accepted/rejected
    const acceptedCount = responses.filter(r => r.action === 'accept').length;
    const rejectedCount = responses.filter(r => r.action === 'reject').length;

    // Notify reviewer (DRD or mentor)
    const isMentorFlow = result.newStatus === 'pending_mentor_approval';
    
    // If mentor flow, notify mentor
    if (isMentorFlow && iprApplication.applicantDetails?.mentorUid) {
      const mentor = await prisma.userLogin.findFirst({
        where: { uid: iprApplication.applicantDetails.mentorUid }
      });
      
      if (mentor) {
        await prisma.notification.create({
          data: {
            userId: mentor.id,
            type: 'ipr_mentor_review_ready',
            title: 'Student Responded to Your Suggestions',
            message: `${applicantName} has addressed your suggested changes in IPR "${iprApplication.title}". Accepted: ${acceptedCount}, Rejected: ${rejectedCount}. Please review and decide to approve or request more changes.`,
            referenceType: 'ipr_application',
            referenceId: iprApplicationId,
            metadata: {
              acceptedCount,
              rejectedCount,
              actionUrl: `/mentor/ipr/${iprApplicationId}`,
              actionLabel: 'Review Application'
            }
          }
        });
      }
    } else if (iprApplication.currentReviewerId) {
      // Notify DRD reviewer
      await prisma.notification.create({
        data: {
          userId: iprApplication.currentReviewerId,
          type: result.remainingPending === 0 ? 'ipr_resubmitted' : 'ipr_suggestion_response',
          title: result.remainingPending === 0 
            ? 'IPR Application Resubmitted' 
            : 'Applicant Responded to Suggestions',
          message: result.remainingPending === 0
            ? `${applicantName} has addressed all requested changes in IPR "${iprApplication.title}". Accepted: ${acceptedCount}, Rejected: ${rejectedCount}. Ready for your review.`
            : `${applicantName} responded to ${responses.length} suggestions. Accepted: ${acceptedCount}, Rejected: ${rejectedCount}. ${result.remainingPending} pending.`,
          referenceType: 'ipr_application',
          referenceId: iprApplicationId,
          metadata: {
            acceptedCount,
            rejectedCount,
            remainingPending: result.remainingPending,
            actionUrl: `/drd-review/${iprApplicationId}`,
            actionLabel: 'Review Application'
          }
        }
      });
    }

    // Update review statistics
    await updateReviewSuggestionCounts(iprApplicationId);

    res.json({
      success: true,
      data: {
        responded: responses.length,
        accepted: acceptedCount,
        rejected: rejectedCount,
        remainingPending: result.remainingPending,
        status: result.newStatus || 'changes_required'
      },
      message: result.remainingPending === 0 
        ? (result.newStatus === 'pending_mentor_approval'
          ? 'All suggestions responded. Application sent back to mentor for review.'
          : 'All suggestions responded. Application resubmitted for review.')
        : `Responded to ${responses.length} suggestions. ${result.remainingPending} pending.`
    });
  } catch (error) {
    console.error('Respond to batch suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to suggestions'
    });
  }
};

/**
 * Get review history for an IPR application
 */
exports.getReviewHistory = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;

    const reviews = await prisma.iprReview.findMany({
      where: { iprApplicationId },
      include: {
        reviewer: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { reviewedAt: 'desc' }
    });

    const suggestions = await prisma.iprEditSuggestion.findMany({
      where: { iprApplicationId },
      include: {
        reviewer: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true, firstName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const workflowHistory = await prisma.iprStatusHistory.findMany({
      where: { iprApplicationId },
      include: {
        changedBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true, firstName: true }
            }
          }
        }
      },
      orderBy: { changedAt: 'desc' }
    });

    // Summary
    const summary = {
      totalReviews: reviews.length,
      totalSuggestions: suggestions.length,
      pendingSuggestions: suggestions.filter(s => s.status === 'pending').length,
      acceptedSuggestions: suggestions.filter(s => s.status === 'accepted').length,
      rejectedSuggestions: suggestions.filter(s => s.status === 'rejected').length,
    };

    res.json({
      success: true,
      data: {
        reviews,
        suggestions,
        workflowHistory,
        summary
      }
    });
  } catch (error) {
    console.error('Get review history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get review history'
    });
  }
};

/**
 * Check if user is the mentor for an IPR application
 */
async function checkMentorPermission(userId, iprApplicationId) {
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: { uid: true }
  });

  if (!user) return false;

  const iprApplication = await prisma.iprApplication.findUnique({
    where: { id: iprApplicationId },
    include: {
      applicantDetails: {
        select: { mentorUid: true }
      }
    }
  });

  return iprApplication?.applicantDetails?.mentorUid === user.uid;
}

/**
 * Mentor creates an edit suggestion (similar to DRD but for mentor review)
 */
exports.mentorCreateEditSuggestion = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;
    const userUid = req.user.uid;
    const {
      fieldName,
      fieldPath,
      originalValue,
      suggestedValue,
      suggestionNote
    } = req.body;

    // Validate required fields
    if (!fieldName || !suggestedValue) {
      return res.status(400).json({
        success: false,
        message: 'Field name and suggested value are required'
      });
    }

    // Check if user is the mentor for this application
    const isMentor = await checkMentorPermission(userId, iprApplicationId);
    if (!isMentor) {
      return res.status(403).json({
        success: false,
        message: 'You are not the mentor for this IPR application'
      });
    }

    // Get the IPR application
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id: iprApplicationId },
      select: {
        id: true,
        title: true,
        applicantUserId: true,
        status: true,
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    // Verify application is in pending_mentor_approval status
    if (iprApplication.status !== 'pending_mentor_approval') {
      return res.status(400).json({
        success: false,
        message: 'Can only suggest edits for applications pending mentor approval'
      });
    }

    // Create the edit suggestion with mentor role (prefix note with [MENTOR])
    const suggestion = await prisma.iprEditSuggestion.create({
      data: {
        iprApplicationId,
        reviewerId: userId,
        fieldName,
        fieldPath,
        originalValue,
        suggestedValue,
        suggestionNote: `[MENTOR] ${suggestionNote || ''}`,
        status: 'pending'
      },
      include: {
        reviewer: {
          select: {
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Note: Status is NOT changed here - mentor must explicitly request changes or approve
    // This allows mentor to add multiple suggestions before making a final decision

    res.status(201).json({
      success: true,
      data: suggestion,
      message: 'Edit suggestion created successfully'
    });
  } catch (error) {
    console.error('Mentor create edit suggestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create edit suggestion',
      error: error.message
    });
  }
};

/**
 * Get mentor's edit suggestions for an IPR application
 */
exports.getMentorEditSuggestions = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;

    // Check if user is the mentor
    const isMentor = await checkMentorPermission(userId, iprApplicationId);
    if (!isMentor) {
      return res.status(403).json({
        success: false,
        message: 'You are not the mentor for this IPR application'
      });
    }

    const suggestions = await prisma.iprEditSuggestion.findMany({
      where: {
        iprApplicationId,
        suggestionNote: { startsWith: '[MENTOR]' }
      },
      include: {
        reviewer: {
          select: {
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Summary
    const summary = {
      total: suggestions.length,
      pending: suggestions.filter(s => s.status === 'pending').length,
      accepted: suggestions.filter(s => s.status === 'accepted').length,
      rejected: suggestions.filter(s => s.status === 'rejected').length
    };

    res.json({
      success: true,
      data: {
        suggestions,
        summary
      }
    });
  } catch (error) {
    console.error('Get mentor edit suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get edit suggestions'
    });
  }
};

/**
 * Submit batch suggestions from mentor and request changes
 */
exports.mentorSubmitBatchSuggestions = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;
    const userId = req.user.id;
    const userUid = req.user.uid;
    const { suggestions, overallComments } = req.body;

    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one suggestion is required'
      });
    }

    // Check if user is the mentor
    const isMentor = await checkMentorPermission(userId, iprApplicationId);
    if (!isMentor) {
      return res.status(403).json({
        success: false,
        message: 'You are not the mentor for this IPR application'
      });
    }

    // Get the IPR application
    const iprApplication = await prisma.iprApplication.findUnique({
      where: { id: iprApplicationId },
      select: {
        id: true,
        title: true,
        applicantUserId: true,
        status: true,
      }
    });

    if (!iprApplication) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    if (iprApplication.status !== 'pending_mentor_approval') {
      return res.status(400).json({
        success: false,
        message: 'Can only request changes for applications pending mentor approval'
      });
    }

    // Get mentor info
    const mentor = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        uid: true,
        employeeDetails: {
          select: { displayName: true, firstName: true }
        }
      }
    });
    const mentorName = mentor?.employeeDetails?.displayName ||
      mentor?.employeeDetails?.firstName ||
      mentor?.uid || 'Your Mentor';

    // Create all suggestions in a transaction
    const createdSuggestions = await prisma.$transaction(async (tx) => {
      const results = [];
      
      for (const suggestion of suggestions) {
        const created = await tx.iprEditSuggestion.create({
          data: {
            iprApplicationId,
            reviewerId: userId,
            fieldName: suggestion.fieldName,
            fieldPath: suggestion.fieldPath,
            originalValue: suggestion.originalValue,
            suggestedValue: suggestion.suggestedValue,
            suggestionNote: `[MENTOR] ${suggestion.suggestionNote || ''}`,
            status: 'pending'
          }
        });
        results.push(created);
      }

      // Update IPR status to changes_required
      await tx.iprApplication.update({
        where: { id: iprApplicationId },
        data: { status: 'changes_required' }
      });

      // Create status history
      await tx.iprStatusHistory.create({
        data: {
          iprApplicationId,
          fromStatus: 'pending_mentor_approval',
          toStatus: 'changes_required',
          changedById: userId,
          comments: overallComments || `Mentor requested ${suggestions.length} change(s)`,
          metadata: {
            action: 'mentor_batch_request_changes',
            mentorUid: userUid,
            suggestionCount: suggestions.length
          }
        }
      });

      return results;
    });

    // Send notification to student
    await prisma.notification.create({
      data: {
        userId: iprApplication.applicantUserId,
        type: 'ipr_mentor_changes_requested',
        title: 'Mentor Requested Changes to Your IPR Application',
        message: `${mentorName} has suggested ${createdSuggestions.length} change(s) to your IPR "${iprApplication.title}". Please review and respond to each suggestion.`,
        referenceType: 'ipr_application',
        referenceId: iprApplicationId,
        metadata: {
          mentorName,
          mentorUid: userUid,
          suggestionCount: createdSuggestions.length,
          overallComments,
          actionUrl: `/ipr/applications/${iprApplicationId}`,
          actionLabel: 'Review Changes'
        }
      }
    });

    res.status(201).json({
      success: true,
      data: createdSuggestions,
      message: `${createdSuggestions.length} suggestion(s) created and sent to student`
    });
  } catch (error) {
    console.error('Mentor submit batch suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit suggestions',
      error: error.message
    });
  }
};

module.exports = {
  startCollaborativeSession: exports.startCollaborativeSession,
  createEditSuggestion: exports.createEditSuggestion,
  getEditSuggestions: exports.getEditSuggestions,
  respondToSuggestion: exports.respondToSuggestion,
  getCollaborativeSession: exports.getCollaborativeSession,
  endCollaborativeSession: exports.endCollaborativeSession,
  submitBatchSuggestions: exports.submitBatchSuggestions,
  respondToBatchSuggestions: exports.respondToBatchSuggestions,
  getReviewHistory: exports.getReviewHistory,
  // Mentor specific
  mentorCreateEditSuggestion: exports.mentorCreateEditSuggestion,
  getMentorEditSuggestions: exports.getMentorEditSuggestions,
  mentorSubmitBatchSuggestions: exports.mentorSubmitBatchSuggestions
};