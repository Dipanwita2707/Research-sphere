require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const log = require("./shared/utils/logger");
const path = require("path");

const config = require("./shared/config/app.config");
const errorHandler = require("./shared/middleware/errorHandler");
const { auditMiddleware } = require("./shared/middleware/audit.middleware");

// Import core module (mounts all routes)
const coreModule = require("./modules/core");

// Import audit module separately (mounted at root level)
const auditModule = require("./modules/audit");

// Import gate-entry module
const gateEntryModule = require('./modules/gate-entry');

const app = express();

// Trust proxy for load balancer (important for rate limiting with 25k users)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());
app.use(cors(config.cors));

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
app.use(compression());

// Audit logging middleware - captures all API requests
app.use(
  auditMiddleware({
    logGetRequests: false, // Don't log GET requests to reduce noise
    logRequestBody: true,
    logResponseBody: false,
  }),
);

// Logging — pretty colorful request logs (replaces morgan + manual slow-request warning)
if (config.env === "development") {
  // Colorful per-request log line with duration + slow tag
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log.req(req.method, req.originalUrl || req.url, res.statusCode, duration);
    });
    next();
  });
}

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

app.get("/cache/stats", protect, restrictTo('admin', 'super_admin'), async (req, res) => {
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
app.post("/cache/flush", protect, restrictTo('admin', 'super_admin'), async (req, res) => {
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

// HTTP Cache headers for static/rarely-changing data
app.use("/api/v1/noting/config", (req, res, next) => {
  res.set(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  next();
});
app.use("/api/v1/dsw/categories", (req, res, next) => {
  res.set(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  next();
});

// API routes
const API_PREFIX = `/api/${config.apiVersion}`;

// Core module (auth, dashboard, research, ipr, grants, finance, etc.)
app.use(`${API_PREFIX}`, coreModule);

// Audit module (separate for security isolation)
app.use(`${API_PREFIX}/audit`, auditModule);

// Gate Entry module
app.use(`${API_PREFIX}/gate-entry`, gateEntryModule);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Start server
const startServer = async () => {
  try {
    const prisma = require("./shared/config/database");
    await prisma.$connect();

    // Initialize Redis cache (with fallback to memory cache)
    const cache = require("./shared/config/redis");
    await cache.initRedis();

    // Initialize audit report scheduler
    const {
      auditReportScheduler,
    } = require("./modules/audit/services/auditScheduler.service");
    await auditReportScheduler.initialize();
    
    // Initialize TMS auto-escalation scheduler
    const { tmsEscalationScheduler } = require('./modules/tms/services/tmsScheduler.service');
    await tmsEscalationScheduler.initialize();
    
    // Initialize email service
    const { emailService } = require("./modules/core/services/email.service");
    await emailService.initialize();
    
    // Initialize QR activation cron job for gate entry
    const { startQRActivationJob } = require('./jobs/qrActivation.job');
    startQRActivationJob();

    // Initialize scheduled email sender
    const emailScheduler = require('./modules/event-management/services/emailScheduler.service');
    emailScheduler.start();

    // Initialize BullMQ email queue (graceful — no-op if Redis unavailable)
    const emailQueue = require('./jobs/emailQueue');
    await emailQueue.init();

    // Initialize BullMQ research workflow queue (graceful — no-op if Redis unavailable)
    const researchWorkflowQueue = require('./jobs/researchWorkflowQueue');
    await researchWorkflowQueue.init();

    // Initialize workflow health monitor
    const { startWorkflowHealthMonitor } = require('./jobs/workflowHealthMonitor.job');
    startWorkflowHealthMonitor();
    
    app.listen(config.port, () => {
      console.log(
        `✅ Server running in ${config.env} mode on port ${config.port}`,
      );
      console.log(
        `🔗 API available at http://localhost:${config.port}${API_PREFIX}`,
      );
      console.log(`🗄️  Database connected via Prisma`);
      console.log(
        `📦 Cache initialized (${cache.isConnected() ? "Redis" : "Memory fallback"})`,
      );
      console.log(`� Email queue: ${emailQueue.isAvailable() ? 'BullMQ (background)' : 'Sync fallback'}`);
      console.log(`🧠 Research workflow queue: ${researchWorkflowQueue.isAvailable() ? 'BullMQ (background)' : 'Sync fallback'}`);
      console.log(`🩺 Workflow health monitor initialized`);
      console.log(`�📊 Audit report scheduler initialized`);
      console.log(`🎫 TMS auto-escalation scheduler initialized`);
      console.log(`🎫 QR activation job started for gate entry`);
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
  stopWorkflowHealthMonitor();
  await emailQueue.shutdown();
  await researchWorkflowQueue.shutdown();
  process.exit(0);
});

module.exports = app;
