/**
 * Prisma client factory (Prisma 7: the client connects through a driver adapter).
 *
 * Pool settings keep the meaning they had with the old Rust engine:
 *   DB_POOL_SIZE     max connections per process                (was connection_limit, default 12)
 *   DB_POOL_TIMEOUT  seconds to wait for a free connection      (was pool_timeout, default 30)
 * Connection options in DATABASE_URL (sslmode, channel_binding, ...) are handled by `pg`.
 */

// Prisma 7 no longer reads .env itself; scripts and tests rely on this.
require('dotenv').config({ quiet: true });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const POOL_SIZE = parseInt(process.env.DB_POOL_SIZE, 10) || 12;
const POOL_TIMEOUT = parseInt(process.env.DB_POOL_TIMEOUT, 10) || 30;

/** @param {import('@prisma/client').Prisma.PrismaClientOptions} [options] extra PrismaClient options (log, transactionOptions, ...) */
function createPrismaClient(options = {}) {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: POOL_SIZE,
    // pg waits this long for a free pooled connection or a new connection to open
    connectionTimeoutMillis: POOL_TIMEOUT * 1000,
    // serverless Postgres (Neon) closes idle connections; retire ours before it does
    idleTimeoutMillis: 30000,
    keepAlive: true,
  });
  return new PrismaClient({ adapter, ...options });
}

module.exports = { createPrismaClient, POOL_SIZE, POOL_TIMEOUT };
