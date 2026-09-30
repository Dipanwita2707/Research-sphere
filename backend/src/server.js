require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { createModuleLogger } = require('./shared/utils/logger');
const log = createModuleLogger('server');

// ── License Protection ────────────────────────────────────────────
// verifyLicense() is called as the FIRST step in startServer().
// The process exits immediately if the license check fails.
const { verifyLicense, startLicenseRecheck, stopLicenseRecheck } = require('./shared/utils/licensing');
// ─────────────────────────────────────────────────────────────

const config = require("./shared/config/app.config");
const errorHandler = require("./shared/middleware/errorHandler");
const { requestId } = require("./shared/middleware/requestId");
const { auditMiddleware } = require("./shared/middleware/audit.middleware");
const { isJobsInstance } = require("./jobs/jobRunner");

// Core module (auth, dashboard, research, ipr, grants, finance, etc.)
const coreModule = require("./modules/core");

// Import audit module separately (mounted at root level)
const auditModule = require("./modules/audit");

// Import superadmin module
const superadminModule = require("./modules/superadmin");
const { licensePublicRoutes } = require("./modules/superadmin");

// Authenticated access to uploaded files (replaces the former public static mount)
const uploadsModule = require("./modules/uploads");

const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Set when a shutdown signal arrives: /ready turns 503 so the load balancer drains us
let isShuttingDown = false;

// Trust proxy for load balancer (important for rate limiting with 25k users)
app.set("trust proxy", 1);

// Request id first so every later log line / error response can carry it
app.use(requestId);

// Security middleware
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────
// Production: only the origins listed in CORS_ORIGIN (comma separated).
// Other environments: CORS_ORIGIN plus the usual localhost dev ports.
const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");
const isProduction = config.env === "production";
const configuredOrigins = isProduction
  ? (process.env.CORS_ORIGIN || "").split(",")
  : Array.isArray(config.cors?.origin) ? config.cors.origin : [];
const devOrigins = isProduction
  ? []
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ];
const allowedOrigins = Array.from(
  new Set([...configuredOrigins, ...devOrigins].map(normalizeOrigin).filter(Boolean)),
);
if (isProduction && allowedOrigins.length === 0) {
  log.warn("CORS_ORIGIN is not set: all cross-origin browser requests will be rejected");
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // same-origin, server-to-server, mobile apps

      if (allowedOrigins.includes(normalizeOrigin(origin))) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id"],
  })
);

// ── Health checks (before rate limiting / audit so probes are cheap) ──────────
// Liveness: the process is up and serving HTTP. No DB call, never 5xx while alive.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Readiness: can we serve traffic? DB reachable within DB_READY_TIMEOUT_MS and not draining.
const READY_TIMEOUT_MS = parseInt(process.env.DB_READY_TIMEOUT_MS, 10) || 3000;
const readinessHandler = async (req, res) => {
  const body = { status: "ok", db: "connected", version: config.apiVersion, timestamp: new Date().toISOString() };
  if (isShuttingDown) {
    return res.status(503).json({ ...body, status: "unavailable", db: "unknown", message: "Shutting down" });
  }
  let timer;
  try {
    const prisma = require("./shared/config/database");
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("DB readiness check timed out")), READY_TIMEOUT_MS);
      }),
    ]);
    return res.status(200).json(body);
  } catch (err) {
    log.warn(`Readiness check failed: ${err.message}`, { requestId: req.id });
    return res.status(503).json({ ...body, status: "unavailable", db: "unreachable" });
  } finally {
    clearTimeout(timer);
  }
};
app.get("/ready", readinessHandler);
app.get(`/api/${config.apiVersion}/health`, readinessHandler);

// Rate limiting - Separate limiters for different endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 min per IP
  message: "Too many login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply strict rate limit to login
app.use("/api/*/auth/login", loginLimiter);

// Apply general rate limit to all API routes and file downloads
app.use("/api/", apiLimiter);
app.use("/uploads", apiLimiter);

// Body parsing: JSON/urlencoded bodies are small; file uploads go through multer
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Compression for responses (reduces bandwidth for 25k users)
const compression = require("compression");
app.use(compression({ threshold: 1024 }));

// Audit logging middleware - captures all API requests
app.use(
  auditMiddleware({
    logGetRequests: true,
    logRequestBody: true,
    logResponseBody: false,
  }),
);

// Route logging — shows method, path, status, latency.
// In development: enabled by default. Set ENABLE_REQUEST_LOG=false to disable (e.g. load testing).
// In production: disabled unless ENABLE_REQUEST_LOG=true.
const shouldLogRequests =
  config.env === "development"
    ? process.env.ENABLE_REQUEST_LOG !== "false"
    : process.env.ENABLE_REQUEST_LOG === "true";

if (shouldLogRequests) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const urlPath = (req.originalUrl || req.url).split("?")[0]; // never log query strings (tokens)
      log.logApiCall(req.method, urlPath, req.user?.id || 'anonymous', res.statusCode, duration, { requestId: req.id });
    });
    next();
  });
}

// Uploaded files: authenticated + tenant/ownership checked (see modules/uploads)
app.use("/uploads", uploadsModule);

// Cache endpoints (platform-wide operations: superadmin only)
const { protect, restrictTo } = require("./shared/middleware/auth");

app.get("/cache/stats", protect, restrictTo('superadmin'), async (req, res, next) => {
  try {
    const cache = require("./shared/config/redis");
    const stats = await cache.getStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/cache/flush", protect, restrictTo('superadmin'), async (req, res, next) => {
  try {
    const cache = require("./shared/config/redis");
    await cache.flush();
    res.status(200).json({
      success: true,
      message: "Cache flushed successfully",
    });
  } catch (error) {
    next(error);
  }
});

// API routes
const API_PREFIX = `/api/${config.apiVersion}`;

// ── Public license verification endpoint (no auth) ─────────────────────────
// Mounted BEFORE protected routes so the client app can verify without a JWT
app.use(`${API_PREFIX}/license`, licensePublicRoutes);
// ─────────────────────────────────────────────────────────────

// Core module (auth, dashboard, research, ipr, grants, finance, etc.)
app.use(`${API_PREFIX}`, coreModule);

// Audit module (separate for security isolation)
app.use(`${API_PREFIX}/audit`, auditModule);

// Superadmin module (SaaS level settings, billing, and tenant configuration)
app.use(`${API_PREFIX}/superadmin`, superadminModule);

// 404 handler (before the error handler so unmatched routes are not treated as errors)
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found", requestId: req.id });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// ── Background work bookkeeping (for graceful shutdown) ──────────────────────
let keepAliveHandle = null;
let jobsStarted = false;

/**
 * Neon keep-alive: opt-in via DB_KEEPALIVE=true. Pings every DB_KEEPALIVE_MS
 * (default 30 s) so Neon's serverless compute does not suspend. Runs on the
 * jobs instance only — one pinger keeps the compute warm for every instance.
 */
function startDbKeepAlive() {
  if (process.env.DB_KEEPALIVE !== "true" || keepAliveHandle) return;
  const intervalMs = parseInt(process.env.DB_KEEPALIVE_MS, 10) || 30 * 1000;
  keepAliveHandle = setInterval(async () => {
    try {
      const prisma = require("./shared/config/database");
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      log.warn(`DB keep-alive ping failed: ${e.message}`);
    }
  }, intervalMs);
  keepAliveHandle.unref();
  log.info(`DB keep-alive enabled (every ${intervalMs / 1000}s)`);
}

/**
 * Schedulers/cron jobs. Only one process may run them (see jobs/jobRunner.js):
 * RUN_JOBS !== 'false' and PM2 instance 0 (NODE_APP_INSTANCE / pm_id).
 */
async function startScheduledJobs() {
  const tenantContext = require("./shared/tenancy/tenantContext");

  // Platform default privacy notice (DPDP) — idempotent, create-if-missing
  try {
    const dpdp = require("./modules/dpdp");
    if (typeof dpdp.ensureDefaultNotice === "function") await dpdp.ensureDefaultNotice();
  } catch (err) {
    log.warn(`Could not ensure default DPDP notice: ${err.message}`);
  }

  // Initialize audit report scheduler (per-tenant reports)
  const { auditReportScheduler } = require("./modules/audit/services/auditScheduler.service");
  await auditReportScheduler.initialize();

  // Initialize workflow health monitor
  const { startWorkflowHealthMonitor } = require('./jobs/workflowHealthMonitor.job');
  startWorkflowHealthMonitor();

  // Initialize scheduled faculty publication sync
  const { startPublicationSyncJob } = require('./jobs/publicationSync.job');
  startPublicationSyncJob();

  // Initialize scheduled API usage aggregator (SaaS billing and monitoring)
  const { startApiUsageJob } = require('./jobs/apiUsageAggregator.job');
  startApiUsageJob();

  // DPDP data retention (dry run unless DPDP_RETENTION_DRY_RUN=false)
  try {
    require('./jobs/dataRetention.job').startDataRetentionJob();
  } catch (err) {
    log.error(`Could not start data retention job: ${err.message}`);
  }

  startDbKeepAlive();

  // Clean up publication sync runs left 'running' by a crash/restart
  // (deliberate cross-tenant maintenance update)
  try {
    const dbPrisma = require("./shared/config/database");
    const cleared = await tenantContext.runAsSystem(() =>
      dbPrisma.publicationImportRun.updateMany({
        where: { status: 'running' },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorSummary: [{ message: 'Server restarted during sync' }]
        }
      })
    );
    if (cleared.count > 0) {
      log.warn(`Cleared ${cleared.count} stuck 'running' publication import runs on startup`);
    }
  } catch (cleanupErr) {
    log.error(`Failed to clear stuck publication import runs: ${cleanupErr.message}`);
  }

  jobsStarted = true;
}

function stopScheduledJobs() {
  if (keepAliveHandle) {
    clearInterval(keepAliveHandle);
    keepAliveHandle = null;
  }
  if (!jobsStarted) return;
  const { auditReportScheduler } = require("./modules/audit/services/auditScheduler.service");
  const { stopWorkflowHealthMonitor } = require('./jobs/workflowHealthMonitor.job');
  const { stopPublicationSyncJob } = require('./jobs/publicationSync.job');
  const { stopApiUsageJob } = require('./jobs/apiUsageAggregator.job');
  auditReportScheduler.stopAll();
  stopWorkflowHealthMonitor();
  stopPublicationSyncJob();
  stopApiUsageJob();
  try { require('./jobs/dataRetention.job').stopDataRetentionJob(); } catch (_) { /* not started */ }
  jobsStarted = false;
}

// Start server
const startServer = async () => {
  try {
    // ── LICENSE CHECK — MUST BE FIRST ──────────────────────────────────────
    // Verifies this machine is authorized to run this codebase.
    // process.exit(1) is called automatically if verification fails.
    await verifyLicense();
    // Periodic re-verification (kill switch): flips licenseState, protect() then 503s
    startLicenseRecheck();
    // ─────────────────────────────────────────────────────────────

    const prisma = require("./shared/config/database");
    await prisma.$connect();

    // Initialize Redis cache (with fallback to memory cache)
    const cache = require("./shared/config/redis");
    await cache.initRedis();

    // Initialize email service
    const { emailService } = require("./modules/core/services/email.service");
    await emailService.initialize();

    // Queues + workers run on every instance (BullMQ distributes jobs safely)
    const emailQueue = require('./jobs/emailQueue');
    await emailQueue.init();

    const researchWorkflowQueue = require('./jobs/researchWorkflowQueue');
    await researchWorkflowQueue.init();

    const runJobs = isJobsInstance();
    if (runJobs) {
      await startScheduledJobs();
    } else {
      log.info('Schedulers disabled on this instance (RUN_JOBS=false or PM2 instance != 0)');
    }

    httpServer.listen(config.port, () => {
      console.log(`✅ Server running in ${config.env} mode on port ${config.port}`);
      console.log(`🔗 API available at http://localhost:${config.port}${API_PREFIX}`);
      console.log(`🗄️  Database connected via Prisma`);
      console.log(`📦 Cache initialized (${cache.isConnected() ? 'Redis' : 'Memory fallback'})`);
      console.log(`📧 Email queue: ${emailQueue.isAvailable() ? 'BullMQ (background)' : 'Sync fallback'}`);
      console.log(`🧠 Research workflow queue: ${researchWorkflowQueue.isAvailable() ? 'BullMQ (background)' : 'Sync fallback'}`);
      console.log(runJobs ? `⏱️  Schedulers running on this instance` : `⏱️  Schedulers disabled on this instance`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

// ── Graceful shutdown ────────────────────────────────────────────────────────
// Stop accepting connections, stop schedulers + licence recheck, drain queues,
// disconnect Prisma, exit. A hard timeout guarantees the process ends even if a
// step hangs (keep PM2 kill_timeout / container stop grace above it).
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 25000;
let shutdownPromise = null;

function gracefulShutdown(signal, exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;
  isShuttingDown = true;
  log.warn(`${signal} received — shutting down gracefully (timeout ${SHUTDOWN_TIMEOUT_MS} ms)`);

  const hardTimer = setTimeout(() => {
    log.error('Graceful shutdown timed out — forcing exit');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);
  hardTimer.unref();

  shutdownPromise = (async () => {
    // 1. Stop accepting new connections; in-flight requests finish
    const serverClosed = httpServer.listening
      ? new Promise((resolve) => httpServer.close(() => resolve()))
      : Promise.resolve();
    if (typeof httpServer.closeIdleConnections === 'function') httpServer.closeIdleConnections();

    // 2. Stop timers / schedulers / licence recheck
    try { stopLicenseRecheck(); } catch (e) { log.error(`stopLicenseRecheck failed: ${e.message}`); }
    try { stopScheduledJobs(); } catch (e) { log.error(`Stopping schedulers failed: ${e.message}`); }

    // 3. Drain queues / workers
    const queueModules = ['./jobs/emailQueue', './jobs/researchWorkflowQueue'];
    await Promise.allSettled(queueModules.map(async (m) => {
      try {
        await require(m).shutdown();
      } catch (e) {
        log.error(`Queue shutdown failed (${m}): ${e.message}`);
      }
    }));

    await serverClosed;

    // 4. Release DB connections
    try {
      const prisma = require("./shared/config/database");
      await prisma.$disconnect();
    } catch (e) {
      log.error(`Prisma disconnect failed: ${e.message}`);
    }

    log.info('Shutdown complete');
    clearTimeout(hardTimer);
    process.exit(exitCode);
  })();
  return shutdownPromise;
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception — shutting down', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException', 1);
});

startServer();

module.exports = app;
