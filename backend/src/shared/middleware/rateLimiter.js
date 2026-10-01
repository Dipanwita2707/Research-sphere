/**
 * Rate Limiting Middleware
 * Implements rate limiting for various endpoints to prevent abuse
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { logRateLimitViolation } = require('../../modules/bug-reports/utils/securityLogger');

/**
 * Rate limiter for bug report submission
 * Limit: 10 reports per hour per user
 */
const bugReportSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the bug report submission limit. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use user ID as key for authenticated users
    return req.user?.id || ipKeyGenerator(req.ip);
  },
  handler: (req, res) => {
    // Log rate limit violation
    console.warn(`Rate limit exceeded for bug report submission - User: ${req.user?.id || req.ip}`);
    
    logRateLimitViolation({
      endpoint: req.originalUrl || req.url,
      userId: req.user?.id,
      ip: req.ip,
      limitType: 'bug_report_submission',
      limit: 10,
      window: '1 hour',
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the bug report submission limit of 10 reports per hour. Please try again later.',
      retryAfter: '1 hour',
    });
  },
});

/**
 * Rate limiter for screenshot uploads
 * Limit: 50 uploads per hour per user
 */
const screenshotUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 requests per hour
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the screenshot upload limit. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req.ip);
  },
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for screenshot upload - User: ${req.user?.id || req.ip}`);
    
    logRateLimitViolation({
      endpoint: req.originalUrl || req.url,
      userId: req.user?.id,
      ip: req.ip,
      limitType: 'screenshot_upload',
      limit: 50,
      window: '1 hour',
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the screenshot upload limit of 50 uploads per hour. Please try again later.',
      retryAfter: '1 hour',
    });
  },
});

/**
 * Rate limiter for admin dashboard endpoints
 * Limit: 100 requests per minute per admin
 */
const adminDashboardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the admin dashboard request limit. Please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req.ip);
  },
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for admin dashboard - Admin: ${req.user?.id || req.ip}`);
    
    logRateLimitViolation({
      endpoint: req.originalUrl || req.url,
      userId: req.user?.id,
      ip: req.ip,
      limitType: 'admin_dashboard',
      limit: 100,
      window: '1 minute',
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the admin dashboard request limit of 100 requests per minute. Please try again later.',
      retryAfter: '1 minute',
    });
  },
});

/**
 * Rate limiter for search queries
 * Limit: 30 requests per minute per user
 */
const searchQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the search query limit. Please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req.ip);
  },
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for search query - User: ${req.user?.id || req.ip}`);
    
    logRateLimitViolation({
      endpoint: req.originalUrl || req.url,
      userId: req.user?.id,
      ip: req.ip,
      limitType: 'search_query',
      limit: 30,
      window: '1 minute',
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded the search query limit of 30 requests per minute. Please try again later.',
      retryAfter: '1 minute',
    });
  },
});

/**
 * Build a limiter for the public password-recovery endpoints.
 * The 429 body keeps the API's { success, code, message } shape.
 */
const passwordRecoveryLimiter = ({ windowMs, max, limitType, windowLabel, keyGenerator, message }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  ...(keyGenerator ? { keyGenerator } : {}),
  handler: (req, res) => {
    logRateLimitViolation({
      endpoint: req.originalUrl || req.url,
      userId: null,
      ip: req.ip,
      limitType,
      limit: max,
      window: windowLabel,
    });
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message,
    });
  },
});

/**
 * Forgot password, per IP: 5 requests per 15 minutes.
 */
const forgotPasswordIpLimiter = passwordRecoveryLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  limitType: 'forgot_password_ip',
  windowLabel: '15 minutes',
  message: 'Too many password reset requests. Please try again in 15 minutes.',
});

/**
 * Forgot password, per email address: 3 requests per hour. Counts every
 * request for the address (registered or not), so it reveals nothing.
 * Must run after body parsing.
 */
const forgotPasswordEmailLimiter = passwordRecoveryLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  limitType: 'forgot_password_email',
  windowLabel: '1 hour',
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `forgot-email:${email}` : `forgot-ip:${ipKeyGenerator(req.ip)}`;
  },
  message: 'Too many password reset requests for this email. Please try again later.',
});

/**
 * Reset password (token submission), per IP: 10 attempts per 15 minutes.
 */
const resetPasswordLimiter = passwordRecoveryLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  limitType: 'reset_password_ip',
  windowLabel: '15 minutes',
  message: 'Too many password reset attempts. Please try again in 15 minutes.',
});

module.exports = {
  bugReportSubmissionLimiter,
  screenshotUploadLimiter,
  adminDashboardLimiter,
  searchQueryLimiter,
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  resetPasswordLimiter,
};
