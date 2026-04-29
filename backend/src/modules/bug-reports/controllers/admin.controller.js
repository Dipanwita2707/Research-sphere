/**
 * Admin Controller
 * Handles admin-specific bug report operations
 */

const bugReportService = require('../services/bugReport.service');

/**
 * Get all bug reports with filtering, search, and pagination
 * GET /api/admin/bug-reports
 */
const getAllBugReports = async (req, res) => {
  try {
    const filters = {
      status: req.query.status || 'all',
      search: req.query.search || '',
      sortBy: req.query.sortBy || 'createdAt',
      order: req.query.order || 'desc',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
    };

    // Get bug reports with filters
    const result = await bugReportService.getAllBugReports(filters);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Log error with context for monitoring
    console.error('Error retrieving bug reports:', {
      error: error.message,
      stack: error.stack,
      filters: req.query,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

/**
 * Get detailed information for a specific bug report
 * GET /api/admin/bug-reports/:id
 */
const getBugReportById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get bug report by ID
    const bugReport = await bugReportService.getBugReportById(id);

    return res.status(200).json({
      success: true,
      data: bugReport,
    });
  } catch (error) {
    // Log error with context
    console.error('Error retrieving bug report:', {
      error: error.message,
      stack: error.stack,
      bugReportId: req.params.id,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error cases
    if (error.message === 'Bug report not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bug report not found',
      });
    }

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

/**
 * Update resolution status of a bug report
 * PATCH /api/admin/bug-reports/:id/status
 */
const updateResolutionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminUserId = req.user.id; // Get admin user ID from authenticated user
    const adminIdentifier = req.user.uid || req.user.email; // Get admin identifier for logging

    // Update resolution status
    const updatedReport = await bugReportService.updateResolutionStatus(
      id,
      status,
      status === 'resolved' ? adminUserId : null,
      adminIdentifier
    );

    return res.status(200).json({
      success: true,
      message: `Bug report marked as ${status}`,
      data: updatedReport,
    });
  } catch (error) {
    // Log error with context
    console.error('Error updating resolution status:', {
      error: error.message,
      stack: error.stack,
      bugReportId: req.params.id,
      status: req.body.status,
      adminId: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error cases
    if (error.message === 'Bug report not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bug report not found',
      });
    }

    if (error.message.includes('required') || error.message.includes('must be')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      });
    }

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

module.exports = {
  getAllBugReports,
  getBugReportById,
  updateResolutionStatus,
};
