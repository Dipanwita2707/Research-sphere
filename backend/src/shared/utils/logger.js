/**
 * Structured Logger Utility
 * Provides consistent logging across all modules with proper formatting and levels
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(LOG_COLORS);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, module, action, userId, ...meta }) => {
    let logMessage = `${timestamp} [${level}]`;
    
    if (module) logMessage += ` [${module}]`;
    if (action) logMessage += ` [${action}]`;
    if (userId) logMessage += ` [User:${userId}]`;
    
    logMessage += `: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: LOG_LEVELS,
  format: fileFormat,
  defaultMeta: { service: 'sgt-ums' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

/**
 * Create a module-specific logger
 * @param {string} moduleName - Name of the module (e.g., 'research', 'bug-reports')
 * @returns {Object} Logger instance with module context
 */
function createModuleLogger(moduleName) {
  return {
    error: (message, meta = {}) => {
      logger.error(message, { module: moduleName, ...meta });
    },
    warn: (message, meta = {}) => {
      logger.warn(message, { module: moduleName, ...meta });
    },
    info: (message, meta = {}) => {
      logger.info(message, { module: moduleName, ...meta });
    },
    http: (message, meta = {}) => {
      logger.http(message, { module: moduleName, ...meta });
    },
    debug: (message, meta = {}) => {
      logger.debug(message, { module: moduleName, ...meta });
    },
    
    // Action-specific logging methods
    logAction: (action, message, meta = {}) => {
      logger.info(message, { module: moduleName, action, ...meta });
    },
    
    logUserAction: (userId, action, message, meta = {}) => {
      logger.info(message, { module: moduleName, action, userId, ...meta });
    },
    
    logError: (action, error, meta = {}) => {
      logger.error(error.message || error, { 
        module: moduleName, 
        action, 
        stack: error.stack,
        ...meta 
      });
    },
    
    logApiCall: (method, endpoint, userId, statusCode, responseTime, meta = {}) => {
      logger.http(`${method} ${endpoint}`, {
        module: moduleName,
        action: 'api_call',
        userId,
        statusCode,
        responseTime,
        ...meta
      });
    },
    
    logDatabaseOperation: (operation, table, userId, meta = {}) => {
      logger.debug(`Database ${operation} on ${table}`, {
        module: moduleName,
        action: 'db_operation',
        operation,
        table,
        userId,
        ...meta
      });
    }
  };
}

/**
 * Express middleware for request logging
 */
function requestLogger(moduleName) {
  return (req, res, next) => {
    const start = Date.now();
    const moduleLogger = createModuleLogger(moduleName);
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const userId = req.user?.id || req.user?.uid || 'anonymous';
      
      moduleLogger.logApiCall(
        req.method,
        req.originalUrl,
        userId,
        res.statusCode,
        duration,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      );
    });
    
    next();
  };
}

module.exports = {
  logger,
  createModuleLogger,
  requestLogger,
  LOG_LEVELS,
  
  // Backward compatibility methods for old logger API
  info: (message, ...args) => logger.info(message, { args }),
  warn: (message, ...args) => logger.warn(message, { args }),
  error: (message, ...args) => logger.error(message, { args }),
  debug: (message, ...args) => logger.debug(message, { args }),
  ok: (message, ...args) => logger.info(message, { args }), // Map 'ok' to 'info'
  slowQuery: (duration, query) => logger.warn(`Slow query detected (${duration}ms)`, { duration, query }),
  req: (method, path, statusCode, duration) => logger.http(`${method} ${path}`, { statusCode, duration, responseTime: duration })
};