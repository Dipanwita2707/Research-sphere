const { PrismaClient } = require('@prisma/client');

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

if (process.env.NODE_ENV === 'production') {
  // Production: single instance with tuned pool
  prisma = new PrismaClient({
    log: ['error'],
    datasources: {
      db: { url: buildDbUrl({ connect_timeout: 15 }) },
    },
    transactionOptions: {
      maxWait: 20000,
      timeout: 30000,
      isolationLevel: 'ReadCommitted',
    },
  });
} else {
  // Development: global singleton to survive HMR
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['warn', 'error'],
      datasources: {
        db: { url: buildDbUrl({ connect_timeout: 15 }) },
      },
      transactionOptions: {
        maxWait: 20000,
        timeout: 30000,
        isolationLevel: 'ReadCommitted',
      },
    });
  }
  prisma = global.prisma;
}

// Aiven / cloud PostgreSQL periodically closes idle connections (OS error 10054 —
// "connection forcibly closed by remote host"). Prisma's internal pool reconnects
// automatically on the next query, so we just do a lightweight startup ping.
// A full manual retry loop is not needed and causes log spam.
const initConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully via Prisma');
  } catch (error) {
    // Non-fatal on startup — Prisma will reconnect on first real query
    console.warn('⚠️ Database startup ping failed (Prisma will retry automatically):', error.message);
  }
};

initConnection();

// Suppress noisy but harmless cloud-idle connection-reset messages
prisma.$on('error', (e) => {
  const msg = (e.message || '').toLowerCase();
  if (
    msg.includes('connection reset') ||
    msg.includes('connection forcibly closed') ||
    msg.includes('kind: io') ||
    msg.includes('econnreset')
  ) {
    // Prisma handles this internally — no log needed
    return;
  }
  console.error('Prisma runtime error:', e);
});

// Handle cleanup on application termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;
