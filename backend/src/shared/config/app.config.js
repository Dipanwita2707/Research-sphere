require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5001,
  apiVersion: process.env.API_VERSION || 'v1',
  
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '7d',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE) || 7,
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
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 500, // Increased from 100
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
