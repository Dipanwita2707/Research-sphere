require('dotenv').config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

// Fail-fast: a strong JWT_SECRET is mandatory in production
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('FATAL: JWT_SECRET must be set to at least 32 characters in production. Aborting.');
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5001,
  apiVersion: process.env.API_VERSION || 'v1',

  // Signed with JWT_SECRET only, so tokens survive redeploys and are valid on every
  // instance. Licence enforcement is separate: see licenseGate in middleware/auth.js.
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production',
    expire: process.env.JWT_EXPIRE || '1d',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE) || 1,
  },

  bcrypt: {
    // Optimized for scalability: 10 rounds = ~100ms, good balance for 25k users
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  },
  
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    // minutes
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 15,
    // Days a tenant subscription may run past currentPeriodEnd before access is blocked
    subscriptionGraceDays: parseInt(process.env.SUBSCRIPTION_GRACE_DAYS) || 7,
  },
  
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(url => url.trim()),
    credentials: true,
  },
  
  rateLimit: {
    // For 25k users: Increased limits for high traffic
    // Dev default is 5000 to avoid hitting limits during development
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'production' ? '500' : '5000'), 10),
  },
  
  database: {
    // Connection pool settings for PostgreSQL (25k concurrent users)
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 20,
      max: parseInt(process.env.DB_POOL_MAX) || 100,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 30000,
    },
  },
};
