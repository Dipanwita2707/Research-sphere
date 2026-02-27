const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Seeding users...');
  
  const password = await bcrypt.hash('Test@123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  // Create Admin user
  const admin = await prisma.UserLogin.upsert({
    where: { uid: 'admin' },
    update: {},
    create: {
      uid: 'admin',
      email: 'admin@sgtuniversity.edu',
      passwordHash: adminPassword,
      role: 'admin',
      status: 'active',
    }
  });
  console.log('✅ Admin user created:', admin.uid);

  const admin2 = await prisma.UserLogin.upsert({
    where: { uid: 'ADMIN001' },
    update: {},
    create: {
      uid: 'ADMIN001',
      email: 'admin@sgt.edu',
      passwordHash: password,
      role: 'admin',
      status: 'active',
    }
  });
  console.log('✅ Admin2 user created:', admin2.uid);

  const superAdmin = await prisma.UserLogin.upsert({
    where: { uid: 'SUPER001' },
    update: {},
    create: {
      uid: 'SUPER001',
      email: 'superadmin@sgt.edu',
      passwordHash: password,
      role: 'superadmin',
      status: 'active',
    }
  });
  console.log('✅ Super Admin created:', superAdmin.uid);

  const student = await prisma.UserLogin.upsert({
    where: { uid: 'STU001' },
    update: {},
    create: {
      uid: 'STU001',
      email: 'student@sgt.edu',
      passwordHash: password,
      role: 'student',
      status: 'active',
    }
  });
  console.log('✅ Student created:', student.uid);

  const faculty = await prisma.UserLogin.upsert({
    where: { uid: 'FAC001' },
    update: {},
    create: {
      uid: 'FAC001',
      email: 'faculty@sgt.edu',
      passwordHash: password,
      role: 'faculty',
      status: 'active',
    }
  });
  console.log('✅ Faculty created:', faculty.uid);

  const staff = await prisma.UserLogin.upsert({
    where: { uid: 'STF001' },
    update: {},
    create: {
      uid: 'STF001',
      email: 'staff@sgt.edu',
      passwordHash: password,
      role: 'staff',
      status: 'active',
    }
  });
  console.log('✅ Staff created:', staff.uid);

  // Guard role doesn't exist in enum, use staff instead
  const guard = await prisma.UserLogin.upsert({
    where: { uid: 'GUARD001' },
    update: {},
    create: {
      uid: 'GUARD001',
      email: 'guard@sgt.edu',
      passwordHash: password,
      role: 'staff', // Using staff role since guard isn't in enum
      status: 'active',
    }
  });
  console.log('✅ Guard created:', guard.uid);

  console.log('\n📋 Login Credentials:');
  console.log('┌─────────────┬───────────┬──────────┐');
  console.log('│ Role        │ UID       │ Password │');
  console.log('├─────────────┼───────────┼──────────┤');
  console.log('│ Admin       │ admin     │ admin123 │');
  console.log('│ Admin       │ ADMIN001  │ Test@123 │');
  console.log('│ Super Admin │ SUPER001  │ Test@123 │');
  console.log('│ Student     │ STU001    │ Test@123 │');
  console.log('│ Faculty     │ FAC001    │ Test@123 │');
  console.log('│ Staff       │ STF001    │ Test@123 │');
  console.log('│ Guard       │ GUARD001  │ Test@123 │');
  console.log('└─────────────┴───────────┴──────────┘');
  
  console.log('\n✅ All users seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
