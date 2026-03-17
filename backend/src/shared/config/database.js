const { PrismaClient } = require("@prisma/client");

// Singleton pattern to prevent multiple Prisma Client instances
let prisma;

// Connection pool size: reduced per-worker to accommodate PM2 cluster mode.
// db.t4g.micro supports ~87 max connections.
// Cluster with 2 workers: 12 per worker × 2 = 24 total, safe for micro instance.
const POOL_SIZE = parseInt(process.env.DB_POOL_SIZE, 10) || 12;
const POOL_TIMEOUT = parseInt(process.env.DB_POOL_TIMEOUT, 10) || 30;

if (process.env.NODE_ENV === "production") {
  // Production: Single instance with connection pooling
  prisma = new PrismaClient({
    log: [{ level: "error", emit: "event" }], // Emit events so $on('error') fires
    datasources: {
      db: {
        url: process.env.DATABASE_URL + `?connection_limit=${POOL_SIZE}&pool_timeout=${POOL_TIMEOUT}`,
      },
    },
    transactionOptions: {
      maxWait: 5000,  // 5s max wait (reduced from 20s — fail fast)
      timeout: 10000, // 10s transaction timeout (reduced from 30s)
      isolationLevel: "ReadCommitted",
    },
  });
} else {
  // Development: Use global variable to preserve client across HMR with connection pooling
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: [
        "warn",
        "error",
        { level: "query", emit: "event" }, // For slow query logging
      ],
      datasources: {
        db: {
          url:
            process.env.DATABASE_URL + `?connection_limit=${POOL_SIZE}&pool_timeout=${POOL_TIMEOUT}`,
        },
      },
      transactionOptions: {
        maxWait: 5000,  // 5s max wait (reduced from 20s — fail fast)
        timeout: 10000, // 10s transaction timeout (reduced from 30s)
        isolationLevel: "ReadCommitted",
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
  const log = require("../utils/logger");
  try {
    await prisma.$connect();
    log.ok("Database connected successfully via Prisma");
    connectionAttempts = 0; // Reset on success
  } catch (error) {
    connectionAttempts++;
    log.error(
      `Database connection attempt ${connectionAttempts} failed: ${error.message}`,
    );

    if (connectionAttempts < MAX_RETRIES) {
      log.warn(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
      setTimeout(connectWithRetry, RETRY_DELAY);
    } else {
      log.error("Max connection retries reached. Exiting...");
      process.exit(1);
    }
  }
};

// Initial connection
connectWithRetry();

// Handle connection errors during runtime
prisma.$on("error", (e) => {
  const log = require("../utils/logger");
  log.error("Prisma runtime error:", e);
  // Attempt to reconnect
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
