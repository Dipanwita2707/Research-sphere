/**
 * Redis Cache Configuration
 * High-performance caching layer for fast data retrieval
 */

const Redis = require('ioredis');

// Redis configuration - REDIS_URL takes precedence, else use individual vars
const redisConfig = process.env.REDIS_URL
  ? {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 1000,
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 10000,
      commandTimeout: 1000, // Reduced from 5000ms — cache should be fast or skip
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 2000, 5000)),
    }
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || null,
      username: process.env.REDIS_USERNAME || null,
      db: parseInt(process.env.REDIS_DB) || 0,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 1000,
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 10000,
      commandTimeout: 1000, // Reduced from 5000ms — cache should be fast or skip
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 2000, 5000)),
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
    redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, redisConfig)
      : new Redis(redisConfig);

    redis.on('connect', () => {
      console.log('[SUCCESS] Redis connected successfully');
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
  USER_SESSION: 1800,       // 30 min - reduce auth DB hits on every request
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
  
  // Event Management (short-lived — registration data changes frequently)
  EVENT_DETAIL: 120,        // 2 min - event detail page
  EVENT_STATS: 60,          // 1 min - statistics dashboard
  EVENT_LIST: 60,           // 1 min - event listings
  
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
  EVENT: 'event:',
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
 * Delete all keys matching a pattern.
 * Uses SCAN (non-blocking, cursor-based) instead of KEYS to avoid
 * blocking Redis on large key-spaces.
 */
const delPattern = async (pattern) => {
  try {
    if (isConnected && redis) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    }
    
    // Memory fallback - delete matching keys
    const plainPattern = pattern.replace(/\*/g, '');
    for (const key of memoryCache.keys()) {
      if (key.includes(plainPattern)) {
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
 * Invalidate user-related caches (auth session, dashboard, permissions, noting permissions)
 *
 * Cache key formats:
 *   user:auth:<userId>        — session from protect middleware
 *   dashboard:<userId>*       — dashboard data
 *   perm:<userId>*            — generic permission cache
 *   noting:perms:<userId>     — noting action-button permissions
 */
const invalidateUser = async (userId) => {
  // Direct key deletes for known key formats
  await del(`${CACHE_KEYS.USER}auth:${userId}`);       // user:auth:<userId>
  await del(`noting:perms:${userId}`);                   // noting:perms:<userId>
  // Pattern deletes for variable-suffix keys
  await delPattern(`${CACHE_KEYS.DASHBOARD}${userId}*`); // dashboard:<userId>*
  await delPattern(`${CACHE_KEYS.PERMISSION}${userId}*`);// perm:<userId>*
  // Wildcard fallback — catch any other user-prefixed keys
  await delPattern(`${CACHE_KEYS.USER}*${userId}*`);     // user:*<userId>*
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
