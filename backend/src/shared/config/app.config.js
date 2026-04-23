require('dotenv').config();

// Fail-fast: JWT_SECRET must be set in production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Aborting.');
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5001,
  apiVersion: process.env.API_VERSION || 'v1',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
    expire: process.env.JWT_EXPIRE || '7d',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE) || 7,
  },

  chatJwt: {
    secret: process.env.CHAT_JWT_SECRET || process.env.JWT_SECRET || 'dev-only-insecure-chat-secret',
    accessExpire: process.env.CHAT_JWT_ACCESS_EXPIRE || '15m',
    refreshExpire: process.env.CHAT_JWT_REFRESH_EXPIRE || '30d',
  },
  
  bcrypt: {
    // Optimized for scalability: 10 rounds = ~100ms, good balance for 25k users
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  },
  
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 15,
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
