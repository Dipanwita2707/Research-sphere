/**
 * Clear Redis analytics cache for the user so fresh data loads immediately
 */
const cache = require('./src/shared/config/redis');
const { initRedis } = cache;
const prisma = require('./src/shared/config/database');

async function main() {
  // Initialize Redis connection
  await initRedis();
  await new Promise(r => setTimeout(r, 1000)); // wait for connection

  const userId = '494a6ed6-149c-4aad-b9e6-ae0e3eaf5e0a';
  
  console.log('Clearing analytics cache for user:', userId);
  
  // Use delPattern to clear all analytics keys for this user
  const r1 = await cache.delPattern(`drd:applicant:${userId}:*`);
  console.log('Cleared drd:applicant cache:', r1);

  const r2 = await cache.delPattern(`drd:applicant:${userId}*`);
  console.log('Cleared drd:applicant wildcard cache:', r2);
  
  // Also clear the user auth cache so the updated permission scope is reloaded
  await cache.invalidateUser(userId);
  console.log('Cleared user auth cache');
  
  console.log('\n✅ Cache cleared. Refresh the analytics page to see the updated data.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
