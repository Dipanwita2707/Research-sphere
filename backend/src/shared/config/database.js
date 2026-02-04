const { PrismaClient } = require('@prisma/client');

// Singleton pattern to prevent multiple Prisma Client instances
let prisma;

if (process.env.NODE_ENV === 'production') {
  // Production: Single instance with connection pooling
  prisma = new PrismaClient({
    log: ['error'], // Minimal logging in production
    datasources: {
      db: {
        url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=20',
      },
    },
    transactionOptions: {
      maxWait: 20000, // 20 seconds max wait
      timeout: 30000, // 30 seconds transaction timeout
      isolationLevel: 'ReadCommitted',
    },
  });
} else {
  // Development: Use global variable to preserve client across HMR with connection pooling
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL + '?connection_limit=5&pool_timeout=20',
        },
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

// Connection retry logic for Neon database
let connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const connectWithRetry = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully via Prisma');
    connectionAttempts = 0; // Reset on success
  } catch (error) {
    connectionAttempts++;
    console.error(`❌ Database connection attempt ${connectionAttempts} failed:`, error.message);
    
    if (connectionAttempts < MAX_RETRIES) {
      console.log(`⏳ Retrying in ${RETRY_DELAY/1000} seconds...`);
      setTimeout(connectWithRetry, RETRY_DELAY);
    } else {
      console.error('❌ Max connection retries reached. Exiting...');
      process.exit(1);
    }
  }
};

// Initial connection
connectWithRetry();

// Handle connection errors during runtime
prisma.$on('error', (e) => {
  console.error('Prisma runtime error:', e);
  // Attempt to reconnect
  if (connectionAttempts === 0) {
    connectWithRetry();
  }
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
