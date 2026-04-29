/**
 * Input Sanitizer
 * Sanitizes user input to prevent XSS attacks and other security issues
 */

/**
 * Strip HTML tags from text to prevent XSS attacks
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text without HTML tags
 */
const stripHtmlTags = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove all HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Decode HTML entities to prevent double encoding
  sanitized = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Remove any remaining HTML tags after decoding
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Validate that URL is from the application domain
 * @param {string} url - URL to validate
 * @param {string[]} allowedDomains - Array of allowed domains (optional)
 * @returns {Object} - { valid: boolean, sanitizedUrl: string, error: string }
 */
const validateApplicationUrl = (url, allowedDomains = []) => {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      sanitizedUrl: '',
      error: 'URL is required',
    };
  }

  try {
    // Parse URL
    const parsedUrl = new URL(url);

    // Default allowed domains (can be overridden via environment variable)
    const defaultAllowedDomains = [
      'localhost',
      '127.0.0.1',
      process.env.APP_DOMAIN || 'sgt-ums.local',
    ];

    const domainsToCheck = allowedDomains.length > 0 ? allowedDomains : defaultAllowedDomains;

    // Check if hostname matches any allowed domain
    const isAllowedDomain = domainsToCheck.some(domain => {
      // Handle localhost with port
      if (domain === 'localhost' || domain === '127.0.0.1') {
        return parsedUrl.hostname === domain || parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
      }
      // Handle exact match or subdomain
      return parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`);
    });

    if (!isAllowedDomain) {
      return {
        valid: false,
        sanitizedUrl: '',
        error: `URL must be from application domain. Allowed domains: ${domainsToCheck.join(', ')}`,
      };
    }

    // Sanitize URL by reconstructing it (removes any malicious components)
    const sanitizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

    return {
      valid: true,
      sanitizedUrl,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      sanitizedUrl: '',
      error: 'Invalid URL format',
    };
  }
};

/**
 * Sanitize filename to prevent path traversal attacks
 * This is already implemented in screenshot.service.js, but we're providing it here for consistency
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed.jpg';
  }

  // Remove any path components (../, ./, /, \)
  let sanitized = filename.replace(/^.*[\\\/]/, '');
  
  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove any control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, '');
  
  // Remove any remaining path traversal attempts
  sanitized = sanitized.replace(/\.\./g, '');
  
  // If filename is empty after sanitization, use a default
  if (!sanitized || sanitized.trim() === '') {
    sanitized = 'unnamed.jpg';
  }
  
  return sanitized;
};

/**
 * Sanitize bug report description
 * Strips HTML tags and limits length
 * @param {string} description - Bug description
 * @param {number} maxLength - Maximum length (default: 2000)
 * @returns {string} - Sanitized description
 */
const sanitizeBugDescription = (description, maxLength = 2000) => {
  if (!description || typeof description !== 'string') {
    return '';
  }

  // Strip HTML tags
  let sanitized = stripHtmlTags(description);

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

/**
 * Sanitize all bug report input data
 * @param {Object} data - Bug report data
 * @returns {Object} - Sanitized data with validation results
 */
const sanitizeBugReportData = (data) => {
  const sanitized = {
    description: sanitizeBugDescription(data.description),
    pageUrl: data.pageUrl,
    routePath: data.routePath,
    userIdentifier: data.userIdentifier,
    userRole: data.userRole,
    userEmail: data.userEmail,
  };

  const errors = [];

  // Validate and sanitize page URL
  const urlValidation = validateApplicationUrl(data.pageUrl);
  if (!urlValidation.valid) {
    errors.push({
      field: 'pageUrl',
      message: urlValidation.error,
    });
  } else {
    sanitized.pageUrl = urlValidation.sanitizedUrl;
  }

  // Sanitize route path (remove any HTML)
  sanitized.routePath = stripHtmlTags(data.routePath || '');

  // Sanitize user identifier (remove any HTML)
  sanitized.userIdentifier = stripHtmlTags(data.userIdentifier || '');

  // Sanitize user role (remove any HTML)
  sanitized.userRole = stripHtmlTags(data.userRole || '');

  // Sanitize user email (remove any HTML)
  if (data.userEmail) {
    sanitized.userEmail = stripHtmlTags(data.userEmail);
  }

  return {
    sanitized,
    errors,
    isValid: errors.length === 0,
  };
};

module.exports = {
  stripHtmlTags,
  validateApplicationUrl,
  sanitizeFilename,
  sanitizeBugDescription,
  sanitizeBugReportData,
};
