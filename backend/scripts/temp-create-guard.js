const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createGuard() {
  const passwordHash = await bcrypt.hash('Test@123', 12);
  
  const guard = await prisma.userLogin.create({
    data: {
      uid: 'GUARD001',
      email: 'guard@sgt.edu',
      role: 'staff',
      passwordHash: passwordHash,
      status: 'active',
      employeeDetails: {
        create: {
          empId: 'GUARD001',
          firstName: 'Ram',
          lastName: 'Singh',
          designation: 'Security Guard',
          email: 'guard@sgt.edu',
          phoneNumber: '9876543299'
        }
      }
    }
  });
  console.log('✅ Guard created: UID=GUARD001, Password=Test@123');
  await prisma.$disconnect();
}
createGuard().catch(e => { console.error(e); prisma.$disconnect(); });
