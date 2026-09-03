require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Measuring Database Query Latency ---');
  
  // Warm up connection
  const startWarm = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const warmTime = Date.now() - startWarm;
  console.log(`Connection warmup + first SELECT 1: ${warmTime}ms`);

  const latencies = [];
  for (let i = 1; i <= 10; i++) {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const duration = Date.now() - start;
    latencies.push(duration);
    console.log(`Query ${i}: ${duration}ms`);
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  console.log(`\nAverage active query latency: ${avg.toFixed(2)}ms`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
