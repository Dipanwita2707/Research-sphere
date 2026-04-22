/**
 * Audit Logging Middleware
 * Automatically captures and logs API requests with relevant details
 */

const { auditService, AuditActionType, AuditSeverity, AuditModule } = require('../../modules/audit/services/audit.service');

// Map HTTP methods to action types
const methodToActionType = {
  GET: AuditActionType.READ,
  POST: AuditActionType.CREATE,
  PUT: AuditActionType.UPDATE,
  PATCH: AuditActionType.UPDATE,
  DELETE: AuditActionType.DELETE
};

// Map route patterns to modules and additional context
const routePatterns = [
  { pattern: /\/auth\/login/, module: AuditModule.AUTH, category: 'authentication', actionType: AuditActionType.LOGIN, skipGet: false },
  { pattern: /\/auth\/logout/, module: AuditModule.AUTH, category: 'authentication', actionType: AuditActionType.LOGOUT },
  { pattern: /\/auth\//, module: AuditModule.AUTH, category: 'authentication' },
  { pattern: /\/ipr\/applications/, module: AuditModule.IPR, category: 'application' },
  { pattern: /\/ipr\//, module: AuditModule.IPR, category: 'general' },
  { pattern: /\/research\/contributions/, module: AuditModule.RESEARCH, category: 'contribution' },
  { pattern: /\/research\/progress-tracker/, module: AuditModule.RESEARCH, category: 'progress-tracker' },
  { pattern: /\/research\//, module: AuditModule.RESEARCH, category: 'general' },
  { pattern: /\/events(?:\/|$)/, module: AuditModule.EVENT, category: 'events' },
  { pattern: /\/dsw(?:\/|$)/, module: AuditModule.DSW, category: 'dsw' },
  { pattern: /\/noting(?:\/|$)/, module: AuditModule.NOTES, category: 'notes' },
  { pattern: /\/permissions/, module: AuditModule.PERMISSION, category: 'permission' },
  { pattern: /\/admin\//, module: AuditModule.ADMIN, category: 'admin' },
  { pattern: /\/dashboard/, module: AuditModule.DASHBOARD, category: 'dashboard', skipGet: true },
  { pattern: /\/users/, module: AuditModule.USER, category: 'user' },
  { pattern: /\/analytics/, module: AuditModule.REPORT, category: 'analytics', skipGet: true },
  { pattern: /\/audit/, module: AuditModule.ADMIN, category: 'audit' },
  { pattern: /\/finance/, module: AuditModule.FINANCE, category: 'finance' }
];

// Routes that should not be logged (reduce noise)
const excludedRoutes = [
  /\/health$/,
  /\/cache\/stats$/,
  /\.ico$/,
  /\.png$/,
  /\.jpg$/,
  /\.css$/,
  /\.js$/
];

// Sensitive fields to mask in logs
const sensitiveFields = ['password', 'passwordHash', 'token', 'refreshToken', 'accessToken', 'secret', 'apiKey'];

/**
 * Mask sensitive data in objects
 */
function maskSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key of Object.keys(masked)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  
  return masked;
}

/**
 * Get route context based on path pattern
 */
function getRouteContext(path) {
  for (const route of routePatterns) {
    if (route.pattern.test(path)) {
      return route;
    }
  }
  return { module: AuditModule.SYSTEM, category: 'general' };
}

/**
 * Check if route should be logged
 */
function shouldLogRoute(path, method) {
  // Check excluded routes
  if (excludedRoutes.some(pattern => pattern.test(path))) {
    return false;
  }
  
  // Get route context
  const context = getRouteContext(path);
  
  // Skip GET requests for certain routes (dashboard, analytics) to reduce noise
  if (method === 'GET' && context.skipGet) {
    return false;
  }
  
  return true;
}

/**
 * Get client IP address
 */
function getClientIp(req) {
  // Try various sources for the real IP address
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  
  // Try connection and socket
  const connectionIp = req.connection?.remoteAddress;
  const socketIp = req.socket?.remoteAddress;
  const ip = connectionIp || socketIp;
  
  // Remove IPv6 prefix if present
  if (ip && ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  // Convert localhost IPv6 to IPv4
  if (ip === '::1') {
    return '127.0.0.1';
  }
  
  return ip || 'unknown';
}

/**
 * Determine severity based on response status
 */
function getSeverity(statusCode, path, method) {
  // 401 on auth endpoints are expected (expired tokens, etc.) - log as INFO
  if (statusCode === 401 && path.includes('/auth/')) {
    return AuditSeverity.INFO;
  }
  
  // 401 elsewhere is more concerning - log as WARNING
  if (statusCode === 401) {
    return AuditSeverity.WARNING;
  }
  
  if (statusCode >= 500) return AuditSeverity.ERROR;
  if (statusCode >= 400) return AuditSeverity.WARNING;
  return AuditSeverity.INFO;
}

/**
 * Generate action description
 */
function generateActionDescription(req, res, routeContext) {
  const method = req.method;
  const path = req.originalUrl || req.url;
  const status = res.statusCode;
  
  // Special cases for authentication
  if (path.includes('/login')) {
    return status < 400 ? 'User logged in successfully' : 'Login attempt failed';
  }
  if (path.includes('/logout')) {
    return 'User logged out';
  }
  
  // Generic action based on method
  const actions = {
    GET: 'Retrieved data',
    POST: 'Created resource',
    PUT: 'Updated resource',
    PATCH: 'Modified resource',
    DELETE: 'Deleted resource'
  };
  
  const baseAction = actions[method] || `${method} request`;
  return `${baseAction} - ${routeContext.module}/${routeContext.category}`;
}

/**
 * Main audit middleware
 * Logs request details after response is sent
 */
const auditMiddleware = (options = {}) => {
  const {
    logGetRequests = true,
    logRequestBody = true,
    logResponseBody = true, // Enable to capture success/failure
    maxBodyLength = 10000
  } = options;

  return (req, res, next) => {
    const startTime = Date.now();
    const originalPath = req.originalUrl || req.url;
    
    // Check if this route should be logged
    if (!shouldLogRoute(originalPath, req.method)) {
      return next();
    }

    // Skip GET requests unless configured otherwise
    // Don't log auth/me checks - too noisy and not valuable
    if (req.method === 'GET' && !logGetRequests) {
      // Allow logging for login/logout, but skip /auth/me health checks
      if (!originalPath.includes('/auth/login') && !originalPath.includes('/auth/logout')) {
        return next();
      }
    }
    
    // Specifically skip /auth/me GET requests - these are health checks
    if (req.method === 'GET' && originalPath.includes('/auth/me')) {
      return next();
    }

    // Store original json function to capture response
    const originalJson = res.json.bind(res);
    let responseBody = null;

    // Always capture response to get actual result data (success/fail, IDs, etc.)
    res.json = function(body) {
      responseBody = body;
      return originalJson(body);
    };

    // Log after response is finished
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const routeContext = getRouteContext(originalPath);
        
        // Determine action type
        let actionType = routeContext.actionType || methodToActionType[req.method] || AuditActionType.OTHER;
        
        // Special handling for specific actions based on path and body
        if (req.body) {
          if (originalPath.includes('/approve')) actionType = AuditActionType.APPROVE;
          if (originalPath.includes('/reject')) actionType = AuditActionType.REJECT;
          if (originalPath.includes('/submit')) actionType = AuditActionType.SUBMIT;
          if (originalPath.includes('/review')) actionType = AuditActionType.REVIEW;
          if (originalPath.includes('/export')) actionType = AuditActionType.EXPORT;
          if (originalPath.includes('/upload')) actionType = AuditActionType.UPLOAD;
        }

        // Helper function to validate UUID format
        const isValidUUID = (str) => {
          if (!str) return false;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(str);
        };

        // Extract target ID from response or params (only if valid UUID)
        let targetId = null;
        let entityId = null;
        let entityName = null;
        const responseData = responseBody?.data;

        if (responseData && typeof responseData === 'object') {
          entityId = responseData.id || responseData.notingId || responseData.eventId || responseData.clubId || null;
          entityName = responseData.name || responseData.title || responseData.clubName || responseData.eventName || null;
        }

        if (responseBody?.data?.id && isValidUUID(responseBody.data.id)) {
          targetId = responseBody.data.id;
        } else if (req.params?.id && isValidUUID(req.params.id)) {
          targetId = req.params.id;
        } else if (req.params?.applicationId && isValidUUID(req.params.applicationId)) {
          targetId = req.params.applicationId;
        } else if (req.params?.contributionId && isValidUUID(req.params.contributionId)) {
          targetId = req.params.contributionId;
        }

        if (!entityId) {
          entityId = req.params?.id || req.params?.clubId || req.params?.memberId || req.params?.applicationId || req.params?.copyId || null;
        }

        if (!entityName && req.params?.id) {
          entityName = `ID:${req.params.id}`;
        }

        // Determine target table from route
        let targetTable = null;
        if (originalPath.includes('/events')) targetTable = 'events';
        if (originalPath.includes('/event-management')) targetTable = 'events';
        if (originalPath.includes('/dsw/clubs')) targetTable = 'dsw_club';
        if (originalPath.includes('/noting')) targetTable = 'note';
        if (originalPath.includes('/ipr')) targetTable = 'ipr_applications';
        if (originalPath.includes('/research')) targetTable = 'research_contributions';
        if (originalPath.includes('/book')) targetTable = 'book_chapters';
        if (originalPath.includes('/conference')) targetTable = 'conference_papers';
        if (originalPath.includes('/grant')) targetTable = 'grant_applications';
        if (originalPath.includes('/permission')) targetTable = 'permissions';
        if (originalPath.includes('/user')) targetTable = 'users';

        const actorName =
          req.user?.employeeDetails?.displayName ||
          req.user?.studentLogin?.displayName ||
          req.user?.uid ||
          'SYSTEM';
        const actorRole = req.user?.role || 'SYSTEM';
        const operationStatus = res.statusCode >= 400 ? 'failed' : 'success';

        // Build audit log data - ALWAYS use req.user if available
        const auditData = {
          actorId: req.user?.id || null, // This should ALWAYS be set if user is authenticated
          performedByName: actorName,
          performedByRole: actorRole,
          action: generateActionDescription(req, res, routeContext),
          description: responseBody?.message || null,
          actionType,
          module: routeContext.module,
          category: routeContext.category,
          severity: getSeverity(res.statusCode, originalPath, req.method),
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'] || null,
          sessionId: req.sessionID || req.headers['x-session-id'] || null,
          requestPath: originalPath,
          requestMethod: req.method,
          responseStatus: res.statusCode,
          duration,
          targetTable,
          targetId,
          entityId,
          entityName,
          status: operationStatus,
          metadata: {}
        };

        // Add request body (masked) for POST/PUT/PATCH
        if (logRequestBody && ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
          const maskedBody = maskSensitiveData(req.body);
          const bodyStr = JSON.stringify(maskedBody);
          if (bodyStr.length <= maxBodyLength) {
            auditData.metadata.requestBody = maskedBody;
            auditData.newValues = maskedBody;
          } else {
            auditData.metadata.requestBody = { _truncated: true, size: bodyStr.length };
          }
        }

        // Add route params if present
        if (Object.keys(req.params || {}).length > 0) {
          auditData.metadata.params = req.params;
          
          // Try to extract target ID (only if valid UUID and not already set)
          if (!auditData.targetId && req.params.id && isValidUUID(req.params.id)) {
            auditData.targetId = req.params.id;
          }
        }

        // Add query params for context
        if (Object.keys(req.query || {}).length > 0) {
          auditData.metadata.query = maskSensitiveData(req.query);
        }

        // Log error message if request failed
        if (res.statusCode >= 400 && responseBody) {
          auditData.errorMessage = responseBody.message || responseBody.error || `HTTP ${res.statusCode}`;
        }

        if (logResponseBody && responseBody && typeof responseBody === 'object') {
          auditData.metadata.responseSummary = {
            success: responseBody.success,
            message: responseBody.message,
          };
        }

        // Fire-and-forget audit log (don't block response pipeline)
        auditService.log(auditData).catch(err => console.error('Audit log error:', err.message));
      } catch (error) {
        console.error('Audit middleware error:', error);
        // Don't break the response - audit is non-critical
      }
    });

    next();
  };
};

/**
 * Specific middleware for logging important actions with more detail
 */
const auditAction = (action, actionType, module, category) => {
  return async (req, res, next) => {
    // Store start time
    req.auditContext = {
      action,
      actionType,
      module,
      category,
      startTime: Date.now()
    };
    
    // Override json to capture response for audit
    const originalJson = res.json.bind(res);
    res.json = async function(body) {
      try {
        const duration = Date.now() - req.auditContext.startTime;
        
        await auditService.log({
          actorId: req.user?.id || null,
          action: req.auditContext.action,
          actionType: req.auditContext.actionType,
          module: req.auditContext.module,
          category: req.auditContext.category,
          severity: res.statusCode >= 400 ? AuditSeverity.WARNING : AuditSeverity.INFO,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          requestPath: req.originalUrl || req.url,
          requestMethod: req.method,
          responseStatus: res.statusCode,
          duration,
          targetId: req.params?.id || body?.data?.id,
          metadata: {
            params: req.params,
            success: body?.success
          },
          errorMessage: body?.success === false ? body?.message : null
        });
      } catch (error) {
        console.error('Audit action error:', error);
      }
      
      return originalJson(body);
    };
    
    next();
  };
};

module.exports = {
  auditMiddleware,
  auditAction,
  maskSensitiveData,
  getClientIp
};
