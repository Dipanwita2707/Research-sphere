const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function main() {
  // Check what's in DB
  const users = await p.UserLogin.findMany({
    where: { uid: { in: ['GUARD001', 'FAC001', 'STF001'] } },
    select: { uid: true, email: true, role: true, status: true }
  });
  console.log('Existing users:', JSON.stringify(users, null, 2));

  // Also check by email
  const byEmail = await p.UserLogin.findMany({
    where: { email: { in: ['guard@sgt.edu', 'faculty@sgt.edu', 'staff@sgt.edu'] } },
    select: { uid: true, email: true, role: true }
  });
  console.log('By email:', JSON.stringify(byEmail, null, 2));

  // Upsert guard and faculty fresh
  const hash = await bcrypt.hash('Test@123', 10);

  try {
    const fac = await p.UserLogin.upsert({
      where: { uid: 'FAC001' },
      update: { email: 'faculty@sgt.edu', passwordHash: hash, role: 'faculty', status: 'active' },
      create: { uid: 'FAC001', email: 'faculty@sgt.edu', passwordHash: hash, role: 'faculty', status: 'active' }
    });
    console.log('✅ Faculty OK:', fac.uid, fac.email);
  } catch (e) {
    console.error('❌ Faculty error:', e.message);
  }

  try {
    const guard = await p.UserLogin.upsert({
      where: { uid: 'GUARD001' },
      update: { email: 'guard@sgt.edu', passwordHash: hash, role: 'staff', status: 'active' },
      create: { uid: 'GUARD001', email: 'guard@sgt.edu', passwordHash: hash, role: 'staff', status: 'active' }
    });
    console.log('✅ Guard OK:', guard.uid, guard.email);
  } catch (e) {
    console.error('❌ Guard error:', e.message);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
