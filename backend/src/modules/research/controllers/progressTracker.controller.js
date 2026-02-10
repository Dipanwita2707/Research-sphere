/**
 * Research Progress Tracker Controller
 * Handles CRUD operations for tracking research progress from communication to publication
 * Status Flow: communicated → accepted → published (with rejected as alternate path)
 */

const prisma = require('../../../shared/config/database');

// Tracking number generation
const generateTrackingNumber = async (publicationType) => {
  const typePrefix = {
    research_paper: 'TRP',
    book: 'TBK',
    book_chapter: 'TBC',
    conference_paper: 'TCP',
    grant_proposal: 'TGP'
  };

  const prefix = typePrefix[publicationType] || 'TRK';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get the latest tracking number for this type and year-month
  const latestTracker = await prisma.researchProgressTracker.findFirst({
    where: {
      trackingNumber: {
        startsWith: `${prefix}-${year}${month}-`
      }
    },
    orderBy: {
      trackingNumber: 'desc'
    }
  });

  let sequence = 1;
  if (latestTracker && latestTracker.trackingNumber) {
    const parts = latestTracker.trackingNumber.split('-');
    sequence = parseInt(parts[2]) + 1;
  }

  return `${prefix}-${year}${month}-${sequence.toString().padStart(4, '0')}`;
};

/**
 * Create a new research progress tracker
 */
const createTracker = async (req, res) => {
  try {
    const { 
      publicationType, 
      title, 
      schoolId, 
      departmentId,
      expectedCompletionDate,
      notes,
      currentStatus,
      // Type-specific data
      researchPaperData,
      bookData,
      bookChapterData,
      conferencePaperData
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!publicationType || !title) {
      return res.status(400).json({
        success: false,
        message: 'Publication type and title are required'
      });
    }

    // Validate publicationType
    const validTypes = ['research_paper', 'book', 'book_chapter', 'conference_paper'];
    if (!validTypes.includes(publicationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid publication type'
      });
    }

    // Validate currentStatus if provided
    const validStatuses = ['communicated', 'rejected', 'accepted', 'published'];
    const initialStatus = currentStatus && validStatuses.includes(currentStatus) ? currentStatus : 'communicated';

    // Generate tracking number
    const trackingNumber = await generateTrackingNumber(publicationType);

    // Create the tracker
    const tracker = await prisma.researchProgressTracker.create({
      data: {
        trackingNumber,
        userId,
        publicationType,
        title,
        schoolId: schoolId || null,
        departmentId: departmentId || null,
        expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : null,
        notes,
        currentStatus: initialStatus,
        // Store type-specific data in the appropriate JSON field
        researchPaperData: publicationType === 'research_paper' ? researchPaperData : null,
        bookData: publicationType === 'book' ? bookData : null,
        bookChapterData: publicationType === 'book_chapter' ? bookChapterData : null,
        conferencePaperData: publicationType === 'conference_paper' ? conferencePaperData : null,
      },
      include: {
        user: {
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
            shortName: true
          }
        },
        department: {
          select: {
            id: true,
            departmentName: true,
            shortName: true
          }
        }
      }
    });

    // Create initial status history entry
    await prisma.researchProgressStatusHistory.create({
      data: {
        trackerId: tracker.id,
        fromStatus: null,
        toStatus: initialStatus,
        reportedDate: new Date(),
        actualDate: new Date(),
        notes: initialStatus === 'writing' ? 'Tracker created' : `Tracker created at ${initialStatus} stage`,
        statusData: {
          initialData: publicationType === 'research_paper' ? researchPaperData :
                       publicationType === 'book' ? bookData :
                       publicationType === 'book_chapter' ? bookChapterData :
                       publicationType === 'conference_paper' ? conferencePaperData : null
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Research progress tracker created successfully',
      data: tracker
    });
  } catch (error) {
    console.error('Error creating research progress tracker:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create research progress tracker',
      error: error.message
    });
  }
};

/**
 * Get all trackers for the current user
 */
const getMyTrackers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, publicationType, page = 1, limit = 10, search } = req.query;

    const where = { userId };

    if (status) {
      where.currentStatus = status;
    }

    if (publicationType) {
      where.publicationType = publicationType;
    }

    // Add search functionality
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { trackingNumber: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [trackers, total] = await Promise.all([
      prisma.researchProgressTracker.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          school: {
            select: { id: true, facultyName: true, shortName: true }
          },
          department: {
            select: { id: true, departmentName: true, shortName: true }
          },
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1
          },
          researchContribution: {
            select: {
              id: true,
              applicationNumber: true,
              status: true
            }
          }
        }
      }),
      prisma.researchProgressTracker.count({ where })
    ]);

    return res.json({
      success: true,
      data: trackers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching trackers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trackers',
      error: error.message
    });
  }
};

/**
 * Get a single tracker by ID
 */
const getTrackerById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { id },
      include: {
        user: {
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
          select: { id: true, facultyName: true, shortName: true }
        },
        department: {
          select: { id: true, departmentName: true, shortName: true }
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        },
        researchContribution: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            incentiveAmount: true,
            pointsAwarded: true
          }
        }
      }
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'Tracker not found'
      });
    }

    // Check if user has permission to view this tracker
    if (tracker.userId !== userId) {
      // Check if user is DRD or has review permissions
      const userRole = req.user.role;
      const allowedRoles = ['superadmin', 'admin'];
      
      // Also allow if user is the DRD reviewer for this school/department
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this tracker'
        });
      }
    }

    return res.json({
      success: true,
      data: tracker
    });
  } catch (error) {
    console.error('Error fetching tracker:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tracker',
      error: error.message
    });
  }
};

/**
 * Update tracker details (not status)
 */
const updateTracker = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      title,
      expectedCompletionDate,
      notes,
      researchPaperData,
      bookData,
      bookChapterData,
      conferencePaperData,
      toStatus,
      newStatus,
      reportedDate,
      actualDate,
      statusData,
      attachments,
      isMonthlyReport,
      currentStatus
    } = req.body;

    console.log('updateTracker called with:', { id, toStatus, newStatus, currentStatus });

    // If status change is requested, delegate to updateTrackerStatus
    const targetStatus = toStatus || newStatus || currentStatus;
    if (targetStatus) {
      // Check if status is actually changing
      const tracker = await prisma.researchProgressTracker.findUnique({
        where: { id }
      });
      
      console.log('Current tracker status:', tracker?.currentStatus, 'Target status:', targetStatus);
      
      if (tracker && tracker.currentStatus !== targetStatus) {
        // Status is changing, use status update logic
        console.log('Delegating to updateTrackerStatus');
        return updateTrackerStatus(req, res);
      }
    }

    // Find the tracker
    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { id }
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'Tracker not found'
      });
    }

    // Check ownership
    if (tracker.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own trackers'
      });
    }

    // Don't allow updates if already linked to a contribution
    if (tracker.researchContributionId) {
      console.log('Tracker already linked to contribution');
      return res.status(400).json({
        success: false,
        message: 'Cannot update tracker that has been submitted for incentive'
      });
    }

    // Build update data based on publication type
    const updateData = {};
    const changedFields = []; // Track changed fields
    
    if (title !== undefined && title !== tracker.title) {
      updateData.title = title;
      changedFields.push({ field: 'title', oldValue: tracker.title, newValue: title });
    }
    if (expectedCompletionDate !== undefined) {
      const newDate = expectedCompletionDate ? new Date(expectedCompletionDate) : null;
      const oldDate = tracker.expectedCompletionDate;
      if (newDate?.getTime() !== oldDate?.getTime()) {
        updateData.expectedCompletionDate = newDate;
        changedFields.push({ field: 'expectedCompletionDate', oldValue: oldDate, newValue: newDate });
      }
    }
    if (notes !== undefined && notes !== tracker.notes) {
      updateData.notes = notes;
      changedFields.push({ field: 'notes', oldValue: tracker.notes, newValue: notes });
    }

    // Track type-specific data changes
    let typeDataChanges = [];
    
    // Update type-specific data
    if (tracker.publicationType === 'research_paper' && researchPaperData !== undefined) {
      const oldData = tracker.researchPaperData || {};
      typeDataChanges = Object.keys(researchPaperData).filter(key => 
        JSON.stringify(oldData[key]) !== JSON.stringify(researchPaperData[key])
      ).map(key => ({ field: key, oldValue: oldData[key], newValue: researchPaperData[key] }));
      updateData.researchPaperData = researchPaperData;
    }
    if (tracker.publicationType === 'book' && bookData !== undefined) {
      const oldData = tracker.bookData || {};
      typeDataChanges = Object.keys(bookData).filter(key => 
        JSON.stringify(oldData[key]) !== JSON.stringify(bookData[key])
      ).map(key => ({ field: key, oldValue: oldData[key], newValue: bookData[key] }));
      updateData.bookData = bookData;
    }
    if (tracker.publicationType === 'book_chapter' && bookChapterData !== undefined) {
      const oldData = tracker.bookChapterData || {};
      typeDataChanges = Object.keys(bookChapterData).filter(key => 
        JSON.stringify(oldData[key]) !== JSON.stringify(bookChapterData[key])
      ).map(key => ({ field: key, oldValue: oldData[key], newValue: bookChapterData[key] }));
      updateData.bookChapterData = bookChapterData;
    }
    if (tracker.publicationType === 'conference_paper' && conferencePaperData !== undefined) {
      const oldData = tracker.conferencePaperData || {};
      typeDataChanges = Object.keys(conferencePaperData).filter(key => 
        JSON.stringify(oldData[key]) !== JSON.stringify(conferencePaperData[key])
      ).map(key => ({ field: key, oldValue: oldData[key], newValue: conferencePaperData[key] }));
      updateData.conferencePaperData = conferencePaperData;
    }

    changedFields.push(...typeDataChanges);

    // Create history entry if there are changes
    let historyEntry = null;
    if (changedFields.length > 0) {
      historyEntry = await prisma.researchProgressStatusHistory.create({
        data: {
          trackerId: id,
          fromStatus: tracker.currentStatus,
          toStatus: tracker.currentStatus,
          reportedDate: new Date(),
          actualDate: new Date(),
          notes: `Updated fields: ${changedFields.map(f => f.field).join(', ')}`,
          statusData: { changedFields },
          attachments: []
        }
      });
    }

    const updatedTracker = await prisma.researchProgressTracker.update({
      where: { id },
      data: updateData,
      include: {
        school: { select: { id: true, facultyName: true, shortName: true } },
        department: { select: { id: true, departmentName: true, shortName: true } }
      }
    });

    return res.json({
      success: true,
      message: 'Tracker updated successfully',
      data: updatedTracker,
      historyEntry
    });
  } catch (error) {
    console.error('Error updating tracker:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update tracker',
      error: error.message
    });
  }
};

/**
 * Update tracker status with status-specific data
 */
const updateTrackerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      newStatus,
      toStatus, // Alternative field name
      reportedDate,
      actualDate,
      notes,
      statusData,
      attachments,
      isMonthlyReport // Flag for monthly reports
    } = req.body;

    // Use toStatus or newStatus
    const targetStatus = toStatus || newStatus;

    // Find the tracker
    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { id },
      include: {
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'Tracker not found'
      });
    }

    // Check ownership
    if (tracker.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own trackers'
      });
    }

    // Validate status transition (allow same status for monthly reports)
    const validTransitions = {
      writing: ['writing', 'communicated'], // Can stay in writing or move to communicated
      communicated: ['communicated', 'writing', 'submitted', 'rejected'], // Can update, go back to writing, or move forward
      submitted: ['submitted', 'rejected', 'accepted'], // Can stay submitted, get rejected, or accepted
      rejected: ['writing', 'communicated', 'submitted'], // Can restart from any earlier stage
      accepted: ['accepted', 'published'], // Can stay accepted or move to published
      published: ['published'] // Final status
    };

    const isMonthlyReportFlag = isMonthlyReport || (tracker.currentStatus === targetStatus);

    if (!validTransitions[tracker.currentStatus]?.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${tracker.currentStatus} to ${targetStatus}`
      });
    }

    // Merge new status data with type-specific tracker data
    let updatedTypeData = {};
    const typeDataField = `${tracker.publicationType.replace('_', '')}Data`;
    
    if (tracker.publicationType === 'research_paper') {
      updatedTypeData.researchPaperData = {
        ...(tracker.researchPaperData || {}),
        ...(statusData || {})
      };
    } else if (tracker.publicationType === 'book') {
      updatedTypeData.bookData = {
        ...(tracker.bookData || {}),
        ...(statusData || {})
      };
    } else if (tracker.publicationType === 'book_chapter') {
      updatedTypeData.bookChapterData = {
        ...(tracker.bookChapterData || {}),
        ...(statusData || {})
      };
    } else if (tracker.publicationType === 'conference_paper') {
      updatedTypeData.conferencePaperData = {
        ...(tracker.conferencePaperData || {}),
        ...(statusData || {})
      };
    }

    // Update tracker and create status history in a transaction
    const [updatedTracker, statusHistoryEntry] = await prisma.$transaction([
      prisma.researchProgressTracker.update({
        where: { id },
        data: {
          currentStatus: targetStatus,
          actualCompletionDate: targetStatus === 'published' ? new Date() : tracker.actualCompletionDate,
          ...updatedTypeData
        },
        include: {
          school: { select: { id: true, facultyName: true, shortName: true } },
          department: { select: { id: true, departmentName: true, shortName: true } }
        }
      }),
      prisma.researchProgressStatusHistory.create({
        data: {
          trackerId: id,
          fromStatus: tracker.currentStatus,
          toStatus: targetStatus,
          reportedDate: reportedDate ? new Date(reportedDate) : new Date(),
          actualDate: actualDate ? new Date(actualDate) : null,
          notes: isMonthlyReportFlag 
            ? `[INFO] Monthly Report: ${notes || 'Progress update'}` 
            : notes,
          statusData: statusData || {},
          attachments: attachments || []
        }
      })
    ]);

    return res.json({
      success: true,
      message: `Status updated to ${newStatus}`,
      data: {
        tracker: updatedTracker,
        statusHistory: statusHistoryEntry
      }
    });
  } catch (error) {
    console.error('Error updating tracker status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update tracker status',
      error: error.message
    });
  }
};

/**
 * Delete a tracker
 */
const deleteTracker = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { id }
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'Tracker not found'
      });
    }

    if (tracker.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own trackers'
      });
    }

    if (tracker.researchContributionId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete tracker that has been submitted for incentive'
      });
    }

    await prisma.researchProgressTracker.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Tracker deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tracker:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete tracker',
      error: error.message
    });
  }
};

/**
 * Get tracker data formatted for incentive submission pre-fill
 */
const getTrackerForSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                designation: true,
                primarySchoolId: true,
                primaryDepartmentId: true
              }
            }
          }
        },
        school: { select: { id: true, facultyName: true, shortName: true } },
        department: { select: { id: true, departmentName: true, shortName: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } }
      }
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'Tracker not found'
      });
    }

    if (tracker.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own research for incentive'
      });
    }

    if (tracker.currentStatus !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Only published research can be submitted for incentive'
      });
    }

    if (tracker.researchContributionId) {
      return res.status(400).json({
        success: false,
        message: 'This tracker has already been submitted for incentive',
        contributionId: tracker.researchContributionId
      });
    }

    // Get the type-specific data
    const typeData = tracker.publicationType === 'research_paper' ? tracker.researchPaperData :
                     tracker.publicationType === 'book' ? tracker.bookData :
                     tracker.publicationType === 'book_chapter' ? tracker.bookChapterData :
                     tracker.publicationType === 'conference_paper' ? tracker.conferencePaperData : {};

    // Transform to contribution format
    const submissionData = {
      trackerId: tracker.id,
      trackingNumber: tracker.trackingNumber,
      publicationType: tracker.publicationType,
      title: tracker.title,
      schoolId: tracker.schoolId,
      departmentId: tracker.departmentId,
      // Common fields from type data
      ...(typeData || {}),
      // Include status history for DRD reviewer reference
      progressHistory: tracker.statusHistory.map(h => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        reportedDate: h.reportedDate,
        actualDate: h.actualDate,
        notes: h.notes,
        statusData: h.statusData,
        changedAt: h.changedAt
      }))
    };

    return res.json({
      success: true,
      data: submissionData
    });
  } catch (error) {
    console.error('Error getting tracker for submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get tracker for submission',
      error: error.message
    });
  }
};

/**
 * Link tracker to a research contribution after submission
 */
const linkToContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { contributionId } = req.body;
    const userId = req.user.id;

    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { id }
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'Tracker not found'
      });
    }

    if (tracker.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only link your own trackers'
      });
    }

    if (tracker.researchContributionId) {
      return res.status(400).json({
        success: false,
        message: 'Tracker is already linked to a contribution'
      });
    }

    // Verify the contribution exists and belongs to the user
    const contribution = await prisma.researchContribution.findUnique({
      where: { id: contributionId }
    });

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Contribution not found'
      });
    }

    if (contribution.applicantUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Contribution does not belong to you'
      });
    }

    const updatedTracker = await prisma.researchProgressTracker.update({
      where: { id },
      data: { researchContributionId: contributionId }
    });

    return res.json({
      success: true,
      message: 'Tracker linked to contribution successfully',
      data: updatedTracker
    });
  } catch (error) {
    console.error('Error linking tracker to contribution:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link tracker to contribution',
      error: error.message
    });
  }
};

/**
 * Get tracker history for a contribution (used by DRD reviewers)
 */
const getTrackerHistoryForContribution = async (req, res) => {
  try {
    const { contributionId } = req.params;

    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { researchContributionId: contributionId },
      include: {
        user: {
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
        },
        statusHistory: {
          orderBy: { changedAt: 'asc' }
        }
      }
    });

    if (!tracker) {
      return res.json({
        success: true,
        data: null,
        message: 'No progress tracker linked to this contribution'
      });
    }

    return res.json({
      success: true,
      data: {
        trackingNumber: tracker.trackingNumber,
        title: tracker.title,
        publicationType: tracker.publicationType,
        createdAt: tracker.createdAt,
        currentStatus: tracker.currentStatus,
        typeData: tracker.publicationType === 'research_paper' ? tracker.researchPaperData :
                  tracker.publicationType === 'book' ? tracker.bookData :
                  tracker.publicationType === 'book_chapter' ? tracker.bookChapterData :
                  tracker.publicationType === 'conference_paper' ? tracker.conferencePaperData : null,
        statusHistory: tracker.statusHistory.map(h => ({
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          reportedDate: h.reportedDate,
          actualDate: h.actualDate,
          notes: h.notes,
          statusData: h.statusData,
          attachments: h.attachments,
          changedAt: h.changedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error getting tracker history for contribution:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get tracker history',
      error: error.message
    });
  }
};

/**
 * Get statistics for user's trackers
 */
const getTrackerStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await prisma.researchProgressTracker.groupBy({
      by: ['currentStatus', 'publicationType'],
      where: { userId },
      _count: true
    });

    // Format the stats
    const formattedStats = {
      byStatus: {},
      byType: {},
      total: 0
    };

    stats.forEach(stat => {
      // By status
      if (!formattedStats.byStatus[stat.currentStatus]) {
        formattedStats.byStatus[stat.currentStatus] = 0;
      }
      formattedStats.byStatus[stat.currentStatus] += stat._count;

      // By type
      if (!formattedStats.byType[stat.publicationType]) {
        formattedStats.byType[stat.publicationType] = 0;
      }
      formattedStats.byType[stat.publicationType] += stat._count;

      formattedStats.total += stat._count;
    });

    return res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Error getting tracker stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get tracker statistics',
      error: error.message
    });
  }
};

module.exports = {
  createTracker,
  getMyTrackers,
  getTrackerById,
  updateTracker,
  updateTrackerStatus,
  deleteTracker,
  getTrackerForSubmission,
  linkToContribution,
  getTrackerHistoryForContribution,
  getTrackerStats
};
