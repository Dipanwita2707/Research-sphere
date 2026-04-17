const { PrismaClient } = require("@prisma/client");

// Singleton pattern to prevent multiple Prisma Client instances
let prisma;

// Build database URL safely — DATABASE_URL already contains query params
// (sslmode, connection_limit, etc.) so we append with '&', not a second '?'
const buildDbUrl = (extraParams = {}) => {
  const base = process.env.DATABASE_URL || '';
  const separator = base.includes('?') ? '&' : '?';
  const extras = Object.entries(extraParams)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return extras ? base + separator + extras : base;
};

// Connection pool size: reduced per-worker to accommodate PM2 cluster mode.
const POOL_SIZE = parseInt(process.env.DB_POOL_SIZE, 10) || 12;
const POOL_TIMEOUT = parseInt(process.env.DB_POOL_TIMEOUT, 10) || 30;

if (process.env.NODE_ENV === 'production') {
  // Production: single instance with tuned pool, emit events for error handling
  prisma = new PrismaClient({
    log: [{ level: 'error', emit: 'event' }],
    datasources: {
      db: { url: buildDbUrl({ connection_limit: POOL_SIZE, pool_timeout: POOL_TIMEOUT, connect_timeout: 15 }) },
    },
    transactionOptions: {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: 'ReadCommitted',
    },
  });
} else {
  // Development: global singleton to survive HMR
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: [
        'warn',
        'error',
        { level: 'query', emit: 'event' }, // For slow query logging
      ],
      datasources: {
        db: { url: buildDbUrl({ connection_limit: POOL_SIZE, pool_timeout: POOL_TIMEOUT, connect_timeout: 15 }) },
      },
      transactionOptions: {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      },
    });
  }
  prisma = global.prisma;
}

// Connection retry logic
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const connectWithRetry = async () => {
  const log = require('../utils/logger');
  try {
    await prisma.$connect();
    log.ok('Database connected successfully via Prisma');
    connectionAttempts = 0;
  } catch (error) {
    connectionAttempts++;
    log.error(`Database connection attempt ${connectionAttempts} failed: ${error.message}`);
    if (connectionAttempts < MAX_RETRIES) {
      log.warn(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
      setTimeout(connectWithRetry, RETRY_DELAY);
    } else {
      log.error('Max connection retries reached. Exiting...');
      process.exit(1);
    }
  }
};

connectWithRetry();

// Error handler: suppress noisy cloud-idle resets, log everything else
prisma.$on('error', (e) => {
  const log = require('../utils/logger');
  const msg = (e.message || '').toLowerCase();
  if (
    msg.includes('connection reset') ||
    msg.includes('connection forcibly closed') ||
    msg.includes('kind: io') ||
    msg.includes('econnreset')
  ) {
    // Prisma handles reconnection internally — no log needed
    return;
  }
  log.error('Prisma runtime error:', e);
  if (connectionAttempts === 0) {
    connectWithRetry();
  }
});

// Slow query logging (development only) — log queries > 500ms
if (process.env.NODE_ENV !== "production") {
  const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS, 10) || 500;
  prisma.$on("query", (e) => {
    const duration = e.duration;
    if (duration >= SLOW_QUERY_MS) {
      const log = require("../utils/logger");
      log.slowQuery(duration, e.query);
    }
  });
}

// Handle cleanup on application termination
// AWS RDS is a persistent server — no keep-alive pings needed.
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;
