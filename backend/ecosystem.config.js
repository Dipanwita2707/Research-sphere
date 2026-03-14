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
      },
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Logging
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
