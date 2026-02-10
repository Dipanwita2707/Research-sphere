const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.club.findMany({
  include: {
    category: { select: { name: true } },
    facultyFacilitator: { select: { email: true, employeeDetails: { select: { displayName: true }}}},
    viceChairperson: { select: { email: true }},
  },
}).then(clubs => {
  clubs.forEach(c => {
    console.log(`\n✅ Club Created:`);
    console.log(`   Club ID: ${c.clubId}`);
    console.log(`   Name: ${c.name}`);
    console.log(`   Category: ${c.category.name}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Faculty: ${c.facultyFacilitator.employeeDetails?.displayName || c.facultyFacilitator.email}`);
    console.log(`   Vice Chair: ${c.viceChairperson.email}`);
    console.log(`   Session: ${c.academicSession}`);
    console.log(`   Created: ${c.createdAt.toLocaleString()}`);
  });
  return prisma.$disconnect();
}).catch(e => {
  console.log('Error:', e.message);
  prisma.$disconnect();
});
