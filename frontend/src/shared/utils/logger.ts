/**
 * Logger Utility
 * Centralized logging with log levels for production-ready code
 * 
 * In development: All logs are shown
 * In production: Only warn and error are shown
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDevelopment = process.env.NODE_ENV ===
   'development';

const defaultConfig: LoggerConfig = {
  level: isDevelopment ? 'debug' : 'warn',
  prefix: '[SGT-UMS]',
  enabled: true,
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `${this.config.prefix} ` : '';
    return `${prefix}[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Debug level - for development debugging only
   * Not shown in production
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * Info level - informational messages
   * Not shown in production by default
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Warn level - warning messages
   * Shown in production
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  /**
   * Error level - error messages
   * Always shown
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Log API request (debug level)
   */
  apiRequest(method: string, url: string, data?: unknown): void {
    this.debug(`API ${method.toUpperCase()} ${url}`, data ? { data } : '');
  }

  /**
   * Log API response (debug level)
   */
  apiResponse(method: string, url: string, status: number, duration?: number): void {
    const durationStr = duration ? ` (${duration}ms)` : '';
    this.debug(`API ${method.toUpperCase()} ${url} → ${status}${durationStr}`);
  }

  /**
   * Log API error (error level)
   */
  apiError(method: string, url: string, error: unknown): void {
    this.error(`API ${method.toUpperCase()} ${url} failed`, error);
  }

  /**
   * Log component lifecycle (debug level)
   */
  component(componentName: string, action: string, data?: unknown): void {
    this.debug(`[${componentName}] ${action}`, data || '');
  }

  /**
   * Log state changes (debug level)
   */
  state(storeName: string, action: string, data?: unknown): void {
    this.debug(`[Store:${storeName}] ${action}`, data || '');
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix} [${prefix}]`,
    });
  }

  /**
   * Temporarily disable logging
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Re-enable logging
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

// Singleton instance
export const logger = new Logger();

// Factory function for creating named loggers
export const createLogger = (name: string): Logger => {
  return logger.child(name);
};

export default logger;
