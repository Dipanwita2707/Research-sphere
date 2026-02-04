/**
 * Redis Cache Configuration
 * High-performance caching layer for fast data retrieval
 */

const Redis = require('ioredis');

// Redis configuration - uses environment variables or defaults
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis-16374.crce263.ap-south-1-1.ec2.cloud.redislabs.com',
  port: parseInt(process.env.REDIS_PORT) || 16374,
  password: process.env.REDIS_PASSWORD || 'wF5uS8DxyUU7OPxwPv2dJOGAOpo9pS6t',
  username: process.env.REDIS_USERNAME || 'default',
  db: parseInt(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 1000,
  enableReadyCheck: true,
  lazyConnect: false, // Connect immediately
  connectTimeout: 10000, // 10 second timeout
  commandTimeout: 5000, // 5 second command timeout
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts
    if (times > 3) {
      return null;
    }
    return Math.min(times * 2000, 5000); // Max 5 second delay
  }
};

// Create Redis instance
let redis = null;
let isConnected = false;
let connectionAttempted = false;

// In-memory fallback cache when Redis is unavailable
const memoryCache = new Map();
const memoryCacheTTL = new Map();

/**
 * Initialize Redis connection
 */
const initRedis = async () => {
  if (connectionAttempted) return redis;
  connectionAttempted = true;

  try {
    redis = new Redis(redisConfig);

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
      isConnected = true;
    });

    let errorCount = 0;
    redis.on('error', (err) => {
      // Only log first few errors to reduce spam
      if (errorCount < 3) {
        console.warn('⚠️ Redis connection error (using memory cache fallback):', err.message);
        errorCount++;
      }
      isConnected = false;
    });

    redis.on('close', () => {
      if (errorCount < 3) {
        console.warn('⚠️ Redis connection closed, using memory fallback');
      }
      isConnected = false;
    });

    // Try to connect with timeout
    await Promise.race([
      redis.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);
    return redis;
  } catch (error) {
    console.warn('⚠️ Redis not available, using in-memory cache fallback');
    isConnected = false;
    return null;
  }
};

/**
 * Cache TTL configurations (in seconds)
 */
const CACHE_TTL = {
  // Short-lived cache (1-5 minutes)
  USER_SESSION: 300,        // 5 min
  DASHBOARD: 120,           // 2 min - Dashboard data
  PERMISSIONS: 300,         // 5 min
  
  // Medium cache (5-30 minutes)
  USER_PROFILE: 600,        // 10 min
  EMPLOYEE_LIST: 300,       // 5 min
  STUDENT_LIST: 300,        // 5 min
  IPR_LIST: 180,            // 3 min
  RESEARCH_LIST: 180,       // 3 min
  
  // Long-lived cache (30 min - 24 hours)
  SCHOOLS: 3600,            // 1 hour - rarely changes
  DEPARTMENTS: 3600,        // 1 hour
  PROGRAMS: 3600,           // 1 hour
  POLICIES: 1800,           // 30 min
  ANALYTICS: 600,           // 10 min
  
  // Static data (24 hours)
  ENUMS: 86400,             // 24 hours
  CONFIG: 86400,            // 24 hours
};

/**
 * Cache key prefixes for organization
 */
const CACHE_KEYS = {
  USER: 'user:',
  DASHBOARD: 'dashboard:',
  EMPLOYEE: 'employee:',
  STUDENT: 'student:',
  SCHOOL: 'school:',
  DEPARTMENT: 'dept:',
  PROGRAM: 'program:',
  IPR: 'ipr:',
  RESEARCH: 'research:',
  POLICY: 'policy:',
  ANALYTICS: 'analytics:',
  PERMISSION: 'perm:',
  LIST: 'list:',
};

/**
 * Get value from cache (Redis or memory fallback)
 */
const get = async (key) => {
  try {
    if (isConnected && redis) {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    }
    
    // Memory fallback
    const ttl = memoryCacheTTL.get(key);
    if (ttl && Date.now() > ttl) {
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
      return null;
    }
    return memoryCache.get(key) || null;
  } catch (error) {
    console.error('Cache get error:', error.message);
    return null;
  }
};

/**
 * Set value in cache with TTL
 */
const set = async (key, value, ttlSeconds = 300) => {
  try {
    const serialized = JSON.stringify(value);
    
    if (isConnected && redis) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      // Memory fallback
      memoryCache.set(key, value);
      memoryCacheTTL.set(key, Date.now() + (ttlSeconds * 1000));
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    return false;
  }
};

/**
 * Delete specific key from cache
 */
const del = async (key) => {
  try {
    if (isConnected && redis) {
      await redis.del(key);
    }
    memoryCache.delete(key);
    memoryCacheTTL.delete(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    return false;
  }
};

/**
 * Delete all keys matching a pattern
 */
const delPattern = async (pattern) => {
  try {
    if (isConnected && redis) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    
    // Memory fallback - delete matching keys
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        memoryCache.delete(key);
        memoryCacheTTL.delete(key);
      }
    }
    return true;
  } catch (error) {
    console.error('Cache pattern delete error:', error.message);
    return false;
  }
};

/**
 * Clear all cache
 */
const flush = async () => {
  try {
    if (isConnected && redis) {
      await redis.flushdb();
    }
    memoryCache.clear();
    memoryCacheTTL.clear();
    return true;
  } catch (error) {
    console.error('Cache flush error:', error.message);
    return false;
  }
};

/**
 * Cache wrapper function - Get or Set pattern
 * @param {string} key - Cache key
 * @param {function} fetchFn - Async function to fetch data if not cached
 * @param {number} ttl - TTL in seconds
 */
const getOrSet = async (key, fetchFn, ttl = 300) => {
  try {
    // Try to get from cache first
    const cached = await get(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Cache the result
    if (data !== null && data !== undefined) {
      await set(key, data, ttl);
    }
    
    return { data, fromCache: false };
  } catch (error) {
    console.error('Cache getOrSet error:', error.message);
    // On error, try to fetch directly
    const data = await fetchFn();
    return { data, fromCache: false };
  }
};

/**
 * Invalidate user-related caches
 */
const invalidateUser = async (userId) => {
  await delPattern(`${CACHE_KEYS.USER}${userId}*`);
  await delPattern(`${CACHE_KEYS.DASHBOARD}${userId}*`);
  await delPattern(`${CACHE_KEYS.PERMISSION}${userId}*`);
};

/**
 * Invalidate list caches (when data changes)
 */
const invalidateLists = async (type) => {
  await delPattern(`${CACHE_KEYS.LIST}${type}*`);
};

/**
 * Get cache statistics
 */
const getStats = async () => {
  try {
    if (isConnected && redis) {
      const info = await redis.info('memory');
      const dbSize = await redis.dbsize();
      return {
        type: 'redis',
        connected: true,
        keys: dbSize,
        info: info
      };
    }
    return {
      type: 'memory',
      connected: false,
      keys: memoryCache.size
    };
  } catch (error) {
    return {
      type: 'memory',
      connected: false,
      keys: memoryCache.size,
      error: error.message
    };
  }
};

module.exports = {
  initRedis,
  get,
  set,
  del,
  delPattern,
  flush,
  getOrSet,
  invalidateUser,
  invalidateLists,
  getStats,
  CACHE_TTL,
  CACHE_KEYS,
  isConnected: () => isConnected
};
