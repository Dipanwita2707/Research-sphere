const { PrismaClient } = require("@prisma/client");

// Singleton pattern to prevent multiple Prisma Client instances
let prisma;

if (process.env.NODE_ENV === "production") {
  // Production: Single instance with connection pooling
  prisma = new PrismaClient({
    log: [{ level: "error", emit: "event" }], // Emit events so $on('error') fires
    datasources: {
      db: {
        url: process.env.DATABASE_URL + "?connection_limit=25&pool_timeout=30",
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
      log:
        process.env.NODE_ENV === "development"
          ? [
              "warn",
              "error",
              { level: "query", emit: "event" }, // Emit query events for slow-query logging
            ]
          : ["error"],
      datasources: {
        db: {
          url:
            process.env.DATABASE_URL + "?connection_limit=5&pool_timeout=30",
        },
      },
      transactionOptions: {
        maxWait: 5000,  // 5s max wait (reduced from 20s — fail fast)
        timeout: 10000, // 10s transaction timeout (reduced from 30s)
        isolationLevel: "ReadCommitted",
      },
    });

    // Log slow queries in development — threshold configurable via env
    if (process.env.NODE_ENV === "development") {
      const log = require("../utils/logger");
      const slowThreshold = parseInt(process.env.PRISMA_SLOW_QUERY_MS, 10) || 500;
      global.prisma.$on("query", (e) => {
        if (e.duration > slowThreshold) {
          log.slowQuery(e.duration, e.query);
        }
      });
    }
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
