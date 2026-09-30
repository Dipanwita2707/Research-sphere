/**
 * PM2 config.
 *
 * Schedulers / cron jobs (audit reports, publication sync, workflow monitor,
 * API usage aggregation, DB keep-alive) run
 * only on instance 0 (PM2 sets NODE_APP_INSTANCE) and only when RUN_JOBS is not
 * "false" — see src/jobs/jobRunner.js. Queue workers run on every instance.
 * On extra hosts/containers running this same file, set RUN_JOBS=false.
 *
 * kill_timeout must exceed SHUTDOWN_TIMEOUT_MS (25 s) so graceful shutdown can
 * drain requests and queues before PM2 sends SIGKILL.
 */
module.exports = {
  apps: [
    {
      name: 'sgt-ums-api',
      script: 'src/server.js',
      instances: 2,            // Match db.t4g.micro 2 vCPUs
      exec_mode: 'cluster',   // Enable cluster mode for multi-core utilization
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'development',
        DB_POOL_SIZE: '12',    // 12 per worker × 2 = 24 total (safe for micro)
        CACHE_MODE: 'memory',  // Use in-memory cache to avoid Upstash latency during load test
        RATE_LIMIT_MAX_REQUESTS: '50000',
      },
      env_production: {
        NODE_ENV: 'production',
        DB_POOL_SIZE: '12',
        RUN_JOBS: 'true',
      },
      // Graceful shutdown (server.js drains for up to SHUTDOWN_TIMEOUT_MS = 25 s)
      kill_timeout: 30000,
      listen_timeout: 10000,
      // Logging
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
