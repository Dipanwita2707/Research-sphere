/**
 * Global Error Handling Middleware
 * Catches all errors and formats them consistently.
 *
 * - Maps Prisma / Postgres / JWT / validation / body-parser / multer / tenant
 *   isolation errors to safe HTTP responses.
 * - Never sends stacks; in production never sends the message of an unexpected
 *   (non-operational) error.
 * - Every error response carries `requestId` (see middleware/requestId.js) and
 *   5xx errors are logged with it.
 */

const { AppError } = require('../utils/AppError');
const { createModuleLogger } = require('../utils/logger');

const log = createModuleLogger('errorHandler');
const isProduction = () => process.env.NODE_ENV === 'production';

function formatIssuePath(path) {
  if (!Array.isArray(path) || path.length === 0) return 'request';

  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      return index === 0 ? segment : `.${segment}`;
    })
    .join('');
}

function mapZodIssuesToFieldErrors(issues = []) {
  const fieldErrors = {};

  for (const issue of issues) {
    const key = formatIssuePath(issue.path);
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

function mapValidationObjectToFieldErrors(errors = {}) {
  const fieldErrors = {};

  for (const [key, value] of Object.entries(errors)) {
    if (!value) continue;
    if (typeof value === 'string') {
      fieldErrors[key] = value;
      continue;
    }
    if (typeof value.message === 'string') {
      fieldErrors[key] = value.message;
    }
  }

  return fieldErrors;
}

/**
 * Handle Prisma-specific errors (never expose model/column/constraint internals)
 */
function handlePrismaError(err) {
  // P2002: Unique constraint violation
  if (err.code === 'P2002') {
    return new AppError('A record with the same details already exists', 409, true);
  }

  // P2025: Record not found (also what a cross-tenant id looks like)
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

  // P2011 / P2012: Null constraint violation / missing required value
  if (err.code === 'P2011' || err.code === 'P2012') {
    return new AppError('A required field is missing', 400, true);
  }

  // P2000: value too long for column
  if (err.code === 'P2000') {
    return new AppError('A field value is too long', 400, true);
  }

  // Database unreachable / pool timeout
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(err.code)) {
    return new AppError('Service temporarily unavailable. Please retry shortly.', 503, true);
  }

  return err;
}

/**
 * Handle PostgreSQL errors (raw queries)
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
 * Map any thrown value to an error with a safe statusCode / isOperational.
 * @param {unknown} input
 * @returns {Error & {statusCode:number,isOperational:boolean,errors?:object,cause?:Error}}
 */
function normalizeError(input) {
  let err = input instanceof Error ? input : new Error(typeof input === 'string' ? input : 'Unknown error');

  // Tenant isolation guard (shared/tenancy/tenantExtension.js)
  if (err.name === 'TenantViolationError') {
    return new AppError('You do not have access to this resource', 403, true);
  }

  // Prisma known request errors carry a P-code
  if (typeof err.code === 'string' && /^P\d{4}$/.test(err.code)) {
    err = handlePrismaError(err);
    if (err instanceof AppError) return err;
  }

  // Remaining Prisma errors are programming/infra errors
  if (err.name === 'PrismaClientInitializationError') {
    return new AppError('Service temporarily unavailable. Please retry shortly.', 503, true);
  }
  if (typeof err.name === 'string' && err.name.startsWith('PrismaClient')) {
    const wrapped = new AppError('A database query error occurred. Please try again or contact support.', 500, true);
    wrapped.cause = err;
    return wrapped;
  }

  // PostgreSQL errors
  if (typeof err.code === 'string' && /^23\d{3}$/.test(err.code)) {
    err = handlePostgresError(err);
    if (err instanceof AppError) return err;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return handleJWTError(err);
  }

  // Zod validation errors
  if (err.name === 'ZodError' && Array.isArray(err.issues)) {
    const fieldErrors = mapZodIssuesToFieldErrors(err.issues);
    const message = Object.values(fieldErrors)[0] || 'Validation failed';
    return new AppError(message, 400, true, fieldErrors);
  }

  // Generic validation libraries (Joi/Mongoose...), without overriding custom AppError ValidationError
  if (err.name === 'ValidationError' && !(err instanceof AppError)) {
    const fieldErrors = mapValidationObjectToFieldErrors(err.errors || {});
    const message = Object.values(fieldErrors).join(', ') || 'Validation failed';
    return new AppError(message, 400, true, Object.keys(fieldErrors).length ? fieldErrors : undefined);
  }

  // Body parser errors
  if (err.type === 'entity.too.large') {
    return new AppError('Request body too large', 413, true);
  }
  if (err.type === 'entity.parse.failed') {
    return new AppError('Malformed JSON in request body', 400, true);
  }

  // Multer upload errors
  if (err.name === 'MulterError') {
    return err.code === 'LIMIT_FILE_SIZE'
      ? new AppError('File too large', 413, true)
      : new AppError('Invalid file upload', 400, true);
  }

  // CORS rejection (server.js origin callback)
  if (err.message === 'Not allowed by CORS') {
    return new AppError('Origin not allowed', 403, true);
  }

  if (!Number.isInteger(err.statusCode)) err.statusCode = 500;
  if (err.isOperational === undefined) {
    // An error thrown with an explicit 4xx status is a client error by construction
    err.isOperational = err.statusCode < 500;
  }
  return err;
}

/**
 * Global error handler middleware
 * Must be defined after all other middleware and routes
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (rawErr, req, res, next) => {
  const err = normalizeError(rawErr);
  const statusCode = err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  const requestId = req.id || null;

  if (statusCode >= 500) {
    const original = err.cause || rawErr || {};
    log.error(original.message || 'Server error', {
      requestId,
      statusCode,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      tenantId: req.tenantId,
      errorName: original.name,
      errorCode: original.code,
      stack: original.stack,
    });
  }

  if (res.headersSent) {
    return next(rawErr);
  }

  // Operational errors carry a client-safe message. In development the message of
  // an unexpected error is shown to speed up debugging (never the stack).
  let message;
  if (err.isOperational) {
    message = err.message;
  } else if (!isProduction()) {
    message = err.message && !/prisma/i.test(err.message)
      ? err.message
      : 'A database query error occurred. Check server logs for details.';
  } else {
    message = 'Something went wrong';
  }

  const response = {
    success: false,
    status: statusCode < 500 ? 'fail' : 'error',
    message,
    requestId,
  };
  // Application error codes (e.g. TOKEN_REVOKED) are safe to pass through
  if (err.isOperational && typeof rawErr?.code === 'string' && /^[A-Z][A-Z_]{2,}$/.test(rawErr.code)) {
    response.code = rawErr.code;
  }
  if (err.isOperational && err.errors && typeof err.errors === 'object') {
    response.errors = err.errors;
  }

  return res.status(statusCode).json(response);
};

errorHandler.normalizeError = normalizeError;

module.exports = errorHandler;
