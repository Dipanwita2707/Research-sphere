/**
 * Bug Report Service
 * Business logic for bug report operations
 */

const prisma = require('../../../shared/config/database');
const screenshotService = require('./screenshot.service');
const { logBugReportSubmission, logResolutionStatusChange } = require('../utils/securityLogger');

/** Error whose message is meant for the client (validation / not found). */
const clientError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode, isOperational: true });

const BUG_REPORT_ADMIN_ROLES = new Set(['admin', 'superadmin']);

/** Reporter or admin/superadmin (tenant scoping of the row itself is automatic). */
const canAccessBugReport = (bugReport, user) =>
  Boolean(user) && (bugReport.userId === user.id || BUG_REPORT_ADMIN_ROLES.has(user.role));

/** Wrap an unexpected error without losing the original; its message stays server-side. */
const internalError = (message, cause) => {
  if (cause && cause.isOperational) return cause;
  const err = new Error(`${message}: ${cause?.message}`);
  err.cause = cause;
  return err;
};

/**
 * Create a new bug report with optional screenshots
 * @param {Object} data - Bug report data
 * @param {string} data.userId - User ID
 * @param {string} data.userRole - User role
 * @param {string} data.userIdentifier - User identifier (UID or registration number)
 * @param {string} data.userEmail - User email (optional)
 * @param {string} data.description - Bug description
 * @param {string} data.pageUrl - Page URL where bug occurred
 * @param {string} data.routePath - Route path
 * @param {Array} files - Array of screenshot files (optional)
 * @returns {Promise<Object>} - Created bug report with screenshots
 */
const createBugReport = async (data, files = []) => {
  // Validate required fields
  if (!data.userId) {
    throw clientError('User ID is required');
  }
  if (!data.userRole) {
    throw clientError('User role is required');
  }
  if (!data.userIdentifier) {
    throw clientError('User identifier is required');
  }
  if (!data.description) {
    throw clientError('Description is required');
  }
  if (!data.pageUrl) {
    throw clientError('Page URL is required');
  }
  if (!data.routePath) {
    throw clientError('Route path is required');
  }

  // Validate description length
  if (data.description.length < 10) {
    throw clientError('Description must be at least 10 characters');
  }
  if (data.description.length > 2000) {
    throw clientError('Description must not exceed 2000 characters');
  }

  // Validate screenshot count
  if (files && files.length > 5) {
    throw clientError('Maximum 5 screenshots allowed per bug report');
  }

  try {
    // Create bug report with default resolution status 'unresolved'
    const bugReport = await prisma.bugReport.create({
      data: {
        userId: data.userId,
        userRole: data.userRole,
        userIdentifier: data.userIdentifier,
        userEmail: data.userEmail || null,
        description: data.description,
        pageUrl: data.pageUrl,
        routePath: data.routePath,
        resolutionStatus: 'unresolved',
        resolvedAt: null,
        resolvedBy: null,
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
          },
        },
        screenshots: true,
      },
    });

    // Save screenshots if provided
    let screenshots = [];
    if (files && files.length > 0) {
      screenshots = await screenshotService.saveScreenshots(
        files,
        bugReport.id,
        data.userId,
        data.userIdentifier,
        bugReport.universityId
      );
    }

    // Log successful bug report submission
    logBugReportSubmission({
      bugReportId: bugReport.id,
      userId: data.userId,
      userIdentifier: data.userIdentifier,
      userRole: data.userRole,
      screenshotCount: screenshots.length,
      success: true,
    });

    return {
      ...bugReport,
      screenshots,
    };
  } catch (error) {
    // Log failed bug report submission
    logBugReportSubmission({
      bugReportId: null,
      userId: data.userId,
      userIdentifier: data.userIdentifier,
      userRole: data.userRole,
      screenshotCount: files ? files.length : 0,
      success: false,
    });
    
    throw internalError('Failed to create bug report', error);
  }
};

/**
 * Get bug report by ID with screenshot metadata
 * @param {string} id - Bug report ID
 * @returns {Promise<Object>} - Bug report with screenshots and user details
 */
const getBugReportById = async (id) => {
  if (!id) {
    throw clientError('Bug report ID is required');
  }

  try {
    const bugReport = await prisma.bugReport.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
          },
        },
        resolver: {
          select: {
            id: true,
            uid: true,
            email: true,
          },
        },
        screenshots: {
          orderBy: {
            uploadedAt: 'asc',
          },
        },
      },
    });

    if (!bugReport) {
      throw clientError('Bug report not found', 404);
    }

    return bugReport;
  } catch (error) {
    throw internalError('Failed to retrieve bug report', error);
  }
};

/**
 * Get all bug reports with filtering, search, sorting, and pagination
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Resolution status filter ('all', 'resolved', 'unresolved')
 * @param {string} filters.search - Search term for description, userIdentifier, pageUrl
 * @param {string} filters.sortBy - Sort field ('createdAt', 'resolutionStatus', 'userRole')
 * @param {string} filters.order - Sort order ('asc', 'desc')
 * @param {number} filters.page - Page number (default: 1)
 * @param {number} filters.limit - Items per page (default: 50, max: 100)
 * @returns {Promise<Object>} - Paginated bug reports with counts
 */
const getAllBugReports = async (filters = {}) => {
  // Set defaults
  const status = filters.status || 'all';
  const search = filters.search || '';
  const sortBy = filters.sortBy || 'createdAt';
  const order = filters.order || 'desc';
  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 50));

  // Build where clause
  const where = {};

  // Filter by resolution status
  if (status === 'resolved') {
    where.resolutionStatus = 'resolved';
  } else if (status === 'unresolved') {
    where.resolutionStatus = 'unresolved';
  }
  // 'all' means no status filter

  // Search across multiple fields
  if (search) {
    where.OR = [
      {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        userIdentifier: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        pageUrl: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        userEmail: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
  }

  // Build orderBy clause
  const orderBy = {};
  if (sortBy === 'createdAt') {
    orderBy.createdAt = order;
  } else if (sortBy === 'resolutionStatus') {
    orderBy.resolutionStatus = order;
  } else if (sortBy === 'userRole') {
    orderBy.userRole = order;
  } else {
    // Default to createdAt if invalid sortBy
    orderBy.createdAt = order;
  }

  try {
    // Get total count for pagination
    const total = await prisma.bugReport.count({ where });

    // Get counts by status
    const [resolvedCount, unresolvedCount] = await Promise.all([
      prisma.bugReport.count({
        where: { resolutionStatus: 'resolved' },
      }),
      prisma.bugReport.count({
        where: { resolutionStatus: 'unresolved' },
      }),
    ]);

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Fetch bug reports
    const reports = await prisma.bugReport.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        university: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        user: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
          },
        },
        resolver: {
          select: {
            id: true,
            uid: true,
            email: true,
          },
        },
        screenshots: {
          select: {
            id: true,
            originalFilename: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: 'asc',
          },
        },
      },
    });

    return {
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      counts: {
        total: resolvedCount + unresolvedCount,
        resolved: resolvedCount,
        unresolved: unresolvedCount,
      },
    };
  } catch (error) {
    throw internalError('Failed to retrieve bug reports', error);
  }
};

/**
 * Update bug report resolution status
 * @param {string} id - Bug report ID
 * @param {string} status - Resolution status ('resolved' or 'unresolved')
 * @param {string} resolvedBy - Admin user ID (required when marking as resolved)
 * @param {string} adminIdentifier - Admin identifier for logging (optional)
 * @returns {Promise<Object>} - Updated bug report
 */
const updateResolutionStatus = async (id, status, resolvedBy, adminIdentifier = null) => {
  if (!id) {
    throw clientError('Bug report ID is required');
  }

  if (!status || !['resolved', 'unresolved'].includes(status)) {
    throw clientError('Status must be either "resolved" or "unresolved"');
  }

  // Check if bug report exists
  const existingReport = await prisma.bugReport.findUnique({
    where: { id },
  });

  if (!existingReport) {
    throw clientError('Bug report not found', 404);
  }

  // Store old status for logging
  const oldStatus = existingReport.resolutionStatus;

  try {
    // Prepare update data based on status
    const updateData = {
      resolutionStatus: status,
    };

    if (status === 'resolved') {
      // When marking as resolved, record timestamp and admin ID
      if (!resolvedBy) {
        throw clientError('Admin user ID is required when marking as resolved');
      }
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = resolvedBy;
    } else {
      // When marking as unresolved, clear timestamp and admin ID
      updateData.resolvedAt = null;
      updateData.resolvedBy = null;
    }

    // Update bug report
    const updatedReport = await prisma.bugReport.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
          },
        },
        resolver: {
          select: {
            id: true,
            uid: true,
            email: true,
          },
        },
        screenshots: true,
      },
    });

    // Log resolution status change for audit trail
    logResolutionStatusChange({
      bugReportId: id,
      adminId: resolvedBy || 'system',
      adminIdentifier: adminIdentifier || resolvedBy || 'system',
      oldStatus,
      newStatus: status,
      timestamp: new Date().toISOString(),
    });

    return updatedReport;
  } catch (error) {
    throw internalError('Failed to update resolution status', error);
  }
};

/**
 * Get screenshots for a bug report
 * @param {string} bugReportId - Bug report ID
 * @returns {Promise<Array>} - Array of screenshot records
 */
const getScreenshots = async (bugReportId, requester = null) => {
  if (!bugReportId) {
    throw clientError('Bug report ID is required');
  }

  try {
    // Verify bug report exists
    const bugReport = await prisma.bugReport.findUnique({
      where: { id: bugReportId },
    });

    // Only the reporter or an admin may see a report's screenshots (same 404 as "missing")
    if (!bugReport || (requester && !canAccessBugReport(bugReport, requester))) {
      throw clientError('Bug report not found', 404);
    }

    // Get screenshots using screenshot service
    const screenshots = await screenshotService.getScreenshotsByBugReportId(bugReportId);

    return screenshots;
  } catch (error) {
    throw internalError('Failed to retrieve screenshots', error);
  }
};

module.exports = {
  createBugReport,
  getBugReportById,
  getAllBugReports,
  updateResolutionStatus,
  getScreenshots,
  canAccessBugReport,
};
