require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createModuleLogger } = require('./shared/utils/logger');
const log = createModuleLogger('server');

// ── License Protection ────────────────────────────────────────────
// verifyLicense() is called as the FIRST step in startServer().
// The process exits immediately if the license check fails.
const { verifyLicense } = require('./shared/utils/licensing');
// ─────────────────────────────────────────────────────────────

const config = require("./shared/config/app.config");
const errorHandler = require("./shared/middleware/errorHandler");
const { auditMiddleware } = require("./shared/middleware/audit.middleware");

// Core module (auth, dashboard, research, ipr, grants, finance, etc.)
const coreModule = require("./modules/core");

// Import audit module separately (mounted at root level)
const auditModule = require("./modules/audit");

// Import superadmin module
const superadminModule = require("./modules/superadmin");
const { licensePublicRoutes } = require("./modules/superadmin");

const app = express();

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// Trust proxy for load balancer (important for rate limiting with 25k users)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());
const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");
const allowedOrigins = Array.from(
  new Set(
    [
      ...(Array.isArray(config.cors?.origin) ? config.cors.origin : []),
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ]
      .map(normalizeOrigin)
      .filter(Boolean),
  ),
);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman / mobile apps

      const normalizedOrigin = normalizeOrigin(origin);

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

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

// Apply general rate limit to all API routes
app.use("/api/", apiLimiter);

// Body parsing middleware with size limits for security
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
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

// Route logging — shows method, path, status, latency, query params.
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
      const path = req.originalUrl || req.url;
      log.logApiCall(req.method, path, req.user?.id || 'anonymous', res.statusCode, duration);
    });
    next();
  });
}

// Serve static files from uploads directory with explicit CORS headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));
// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Health check (both at root and API level for Render)
// Also serves as DB keep-alive to prevent Neon cold starts
app.get("/health", async (req, res) => {
  try {
    const prisma = require("./shared/config/database");
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      message: "Server is running",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(200).json({
      status: "ok",
      message: "Server is running",
      db: "reconnecting",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API is running",
    timestamp: new Date().toISOString(),
    version: "v1",
  });
});

// Cache stats endpoint (requires authentication)
const { protect, restrictTo } = require("./shared/middleware/auth");

app.get("/cache/stats", protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const cache = require("./shared/config/redis");
    const stats = await cache.getStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Cache stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cache stats',
    });
  }
});

// Cache flush endpoint (admin only)
app.post("/cache/flush", protect, restrictTo('admin', 'superadmin'), async (req, res) => {
  try {
    const cache = require("./shared/config/redis");
    await cache.flush();
    res.status(200).json({
      success: true,
      message: "Cache flushed successfully",
    });
  } catch (error) {
    console.error('Cache flush error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to flush cache',
    });
  }
});

// DB keep-alive: ping every 30 seconds to prevent Neon serverless cold starts.
// Neon suspends compute after ~5 min of inactivity; at 30 s the compute stays
// permanently warm during working hours with negligible DB load (SELECT 1).
// Previously 90 s which still allowed occasional cold-start stalls on the first
// request after a burst of inactivity.
setInterval(async () => {
  try {
    const prisma = require("./shared/config/database");
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.warn("⚠️ DB keep-alive ping failed:", e.message);
  }
}, 30 * 1000);

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

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Start server
const startServer = async () => {
  try {
    // ── LICENSE CHECK — MUST BE FIRST ──────────────────────────────────────
    // Verifies this machine is authorized to run this codebase.
    // process.exit(1) is called automatically if verification fails.
    await verifyLicense();
    // ─────────────────────────────────────────────────────────────

    const prisma = require("./shared/config/database");
    await prisma.$connect();

    // Initialize Redis cache (with fallback to memory cache)
    const cache = require("./shared/config/redis");
    await cache.initRedis();
    
    // Socket.io was removed as Chat module is disabled
    

    // Initialize audit report scheduler
    const {
      auditReportScheduler,
    } = require("./modules/audit/services/auditScheduler.service");
    await auditReportScheduler.initialize();
    
    // Initialize email service
    const { emailService } = require("./modules/core/services/email.service");
    await emailService.initialize();

    // Initialize BullMQ email queue (graceful — no-op if Redis unavailable)
    const emailQueue = require('./jobs/emailQueue');
    await emailQueue.init();

    // Initialize BullMQ research workflow queue (graceful — no-op if Redis unavailable)
    const researchWorkflowQueue = require('./jobs/researchWorkflowQueue');
    await researchWorkflowQueue.init();

    // Initialize workflow health monitor
    const { startWorkflowHealthMonitor } = require('./jobs/workflowHealthMonitor.job');
    startWorkflowHealthMonitor();

    // Initialize scheduled faculty publication sync
    const { startPublicationSyncJob } = require('./jobs/publicationSync.job');
    startPublicationSyncJob();

    // Initialize scheduled API usage aggregator (SaaS billing and monitoring)
    const { startApiUsageJob } = require('./jobs/apiUsageAggregator.job');
    startApiUsageJob();

    // Clean up any stale running publication sync runs from previous crashes/restarts
    try {
      const dbPrisma = require("./shared/config/database");
      const cleared = await dbPrisma.publicationImportRun.updateMany({
        where: { status: 'running' },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorSummary: [{ message: 'Server restarted during sync' }]
        }
      });
      if (cleared.count > 0) {
        log.warn(`Cleared ${cleared.count} stuck 'running' publication import runs on startup`);
      }
    } catch (cleanupErr) {
      log.error('Failed to clear stuck publication import runs:', cleanupErr.message);
    }

    httpServer.listen(config.port, () => {
      console.log(`✅ Server running in ${config.env} mode on port ${config.port}`);
      console.log(`🔗 API available at http://localhost:${config.port}${API_PREFIX}`);
      console.log(`🗄️  Database connected via Prisma`);
      console.log(`📦 Cache initialized (${cache.isConnected() ? 'Redis' : 'Memory fallback'})`);
      console.log(`📧 Email queue: ${emailQueue.isAvailable() ? 'BullMQ (background)' : 'Sync fallback'}`);
      console.log(`🧠 Research workflow queue: ${researchWorkflowQueue.isAvailable() ? 'BullMQ (background)' : 'Sync fallback'}`);
      console.log(`🩺 Workflow health monitor initialized`);
      console.log(`📚 Publication sync job initialized`);
      console.log(`📊 Audit report scheduler initialized`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown — clean up BullMQ connections
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down background queues…');
  const emailQueue = require('./jobs/emailQueue');
  const researchWorkflowQueue = require('./jobs/researchWorkflowQueue');
  const { stopWorkflowHealthMonitor } = require('./jobs/workflowHealthMonitor.job');
  const { stopPublicationSyncJob } = require('./jobs/publicationSync.job');
  const { stopApiUsageJob } = require('./jobs/apiUsageAggregator.job');
  stopWorkflowHealthMonitor();
  stopPublicationSyncJob();
  stopApiUsageJob();
  await emailQueue.shutdown();
  await researchWorkflowQueue.shutdown();
  process.exit(0);
});

module.exports = app;
