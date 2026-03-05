/**
 * Standardized API Response Helper
 * Provides consistent response structure across all endpoints
 */

class ApiResponse {
  /**
   * Send success response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   */
  static success(res, data = null, message = 'Success', statusCode = 200) {
    const response = {
      success: true,
      message,
    };

    if (data !== null) {
      response.data = data;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send created response (201)
   * @param {Object} res - Express response object
   * @param {*} data - Created resource data
   * @param {string} message - Success message
   */
  static created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  /**
   * Send success response with pagination
   * @param {Object} res - Express response object
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination metadata
   * @param {string} message - Success message
   */
  static paginated(res, data, pagination, message = 'Success') {
    const limit = pagination.limit || 1; // guard against divide-by-zero
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit,
        total: pagination.total,
        totalPages: pagination.totalPages || Math.ceil(pagination.total / limit),
      },
    });
  }

  /**
   * Send no content response (204)
   * @param {Object} res - Express response object
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default 500)
   * @param {Object} [errors] - Optional validation errors or details
   */
  static error(res, message = 'Internal server error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
    };
    if (errors) {
      response.errors = errors;
    }
    return res.status(statusCode).json(response);
  }
}

module.exports = ApiResponse;
