const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.club.count().then(count => {
  console.log(`Clubs: ${count}`);
  return prisma.$disconnect();
}).catch(e => {
  console.log('Error:', e.message.substring(0, 200));
  prisma.$disconnect();
});
