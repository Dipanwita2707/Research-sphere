/**
 * Global Error Handling Middleware
 * Catches all errors and formats them consistently
 * Handles Prisma-specific errors and converts them to appropriate HTTP responses
 */

const { AppError } = require('../utils/AppError');

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(err) {
  // P2002: Unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    return new AppError(`Duplicate value for ${field}`, 409, true);
  }

  // P2025: Record not found
  if (err.code === 'P2025') {
    return new AppError('Record not found', 404, true);
  }

  // P2003: Foreign key constraint violation
  if (err.code === 'P2003') {
    return new AppError('Related record not found', 400, true);
  }

  // P2014: Invalid relation
  if (err.code === 'P2014') {
    return new AppError('Invalid relationship between records', 400, true);
  }

  // P2011: Null constraint violation
  if (err.code === 'P2011') {
    const field = err.meta?.column || 'field';
    return new AppError(`${field} is required`, 400, true);
  }

  return err;
}

/**
 * Handle PostgreSQL errors
 */
function handlePostgresError(err) {
  if (err.code === '23505') { // Unique violation
    return new AppError('Resource already exists', 409, true);
  }
  
  if (err.code === '23503') { // Foreign key violation
    return new AppError('Referenced resource does not exist', 400, true);
  }
  
  if (err.code === '23502') { // Not null violation
    return new AppError('Required field is missing', 400, true);
  }

  return err;
}

/**
 * Handle JWT errors
 */
function handleJWTError(err) {
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, true);
  }
  
  if (err.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401, true);
  }

  return err;
}

/**
 * Development error response - includes full details
 */
function sendErrorDev(err, req, res) {
  console.error('ERROR 💥', {
    message: err.message,
    stack: err.stack,
    error: err,
  });

  // Even in dev, sanitize Prisma internal details from the response
  const sanitizedMessage = (err.message && err.message.includes('prisma'))
    ? 'A database query error occurred. Check server logs for details.'
    : err.message;

  res.status(err.statusCode || 500).json({
    success: false,
    status: err.status,
    message: sanitizedMessage,
    path: req.path,
    method: req.method,
  });
}

/**
 * Production error response - sanitized
 */
function sendErrorProd(err, req, res) {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or unknown error: don't leak error details
    console.error('ERROR 💥', err);

    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went wrong',
    });
  }
}

/**
 * Global error handler middleware
 * Must be defined after all other middleware and routes
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  err.isOperational = err.isOperational !== undefined ? err.isOperational : false;

  // Handle Prisma errors
  if (err.code && err.code.startsWith('P')) {
    err = handlePrismaError(err);
  }

  // Handle Prisma validation errors (invalid queries, unknown fields, etc.)
  if (err.name === 'PrismaClientValidationError' || err.name === 'PrismaClientKnownRequestError') {
    console.error('Prisma Validation Error:', err.message);
    err = new AppError('A database query error occurred. Please try again or contact support.', 500, true);
  }

  // Handle PostgreSQL errors
  if (err.code && err.code.startsWith('23')) {
    err = handlePostgresError(err);
  }

  // Handle JWT errors
  if (err.name && (err.name.includes('JsonWebToken') || err.name.includes('TokenExpired'))) {
    err = handleJWTError(err);
  }

  // Handle Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map(e => e.message).join(', ');
    err = new AppError(message || 'Validation failed', 400, true);
  }

  // Log error for monitoring
  if (err.statusCode >= 500) {
    console.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      user: req.user?.id,
      timestamp: new Date().toISOString(),
    });
  }

  // Send appropriate response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    sendErrorProd(err, req, res);
  }
};

module.exports = errorHandler;
